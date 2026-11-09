/**
 * Pure mapping from validated HenrikDev payloads to database rows.
 * No I/O here, so every rule is unit-tested.
 */
import type {
  NewMatch,
  NewMatchKill,
  NewMatchPlayer,
  NewMatchRound,
  NewMatchRoundPlayer,
  NewMmrSnapshot,
} from "@/db/schema";
import type { HenrikMatch, HenrikMmrEntry } from "@/lib/henrik";

export const COMPETITIVE = "competitive";

/** Stable queue key; empty or missing ids become "unknown". */
export function queueIdOf(match: HenrikMatch): string {
  return match.metadata.queue?.id?.trim() || "unknown";
}

/** Only finished matches with players are worth storing. */
export function isStorable(match: HenrikMatch): boolean {
  return match.metadata.is_completed !== false && match.players.length > 0;
}

export function includesPlayer(match: HenrikMatch, puuid: string): boolean {
  return match.players.some((p) => p.puuid === puuid);
}

function teamScore(match: HenrikMatch, teamId: string): number | null {
  const team = match.teams?.find((t) => t.team_id.toLowerCase() === teamId.toLowerCase());
  return team?.rounds?.won ?? null;
}

/** The team flagged as winner; null on a draw or in modes without teams. */
export function winningTeamOf(match: HenrikMatch): string | null {
  const winners = match.teams?.filter((t) => t.won === true) ?? [];
  return winners.length === 1 ? winners[0]!.team_id : null;
}

export function roundsPlayedOf(match: HenrikMatch): number {
  const rounds = match.rounds?.length ?? 0;
  if (rounds > 0) return rounds;
  // Fallback when rounds are omitted: every round is won by someone.
  return (match.teams ?? []).reduce((sum, t) => sum + (t.rounds?.won ?? 0), 0);
}

const int = (n: number) => Math.round(n);

export function toMatchRow(match: HenrikMatch, roundsSyncedAt?: Date): NewMatch {
  const { metadata } = match;
  return {
    id: metadata.match_id,
    mapId: metadata.map?.id ?? null,
    mapName: metadata.map?.name ?? null,
    mode: metadata.queue?.name ?? null,
    queueId: queueIdOf(match),
    seasonId: metadata.season?.id ?? null,
    startedAt: new Date(metadata.started_at),
    gameLengthMs: metadata.game_length_in_ms == null ? null : int(metadata.game_length_in_ms),
    roundsPlayed: roundsPlayedOf(match),
    redScore: teamScore(match, "Red"),
    blueScore: teamScore(match, "Blue"),
    winningTeam: winningTeamOf(match),
    roundsSyncedAt: match.rounds == null ? null : (roundsSyncedAt ?? null),
  };
}

/** All players of the match (not only our users), keyed by puuid. */
export function toPlayerRows(match: HenrikMatch): NewMatchPlayer[] {
  const winningTeam = winningTeamOf(match);
  const seen = new Set<string>();
  const rows: NewMatchPlayer[] = [];
  for (const p of match.players) {
    if (seen.has(p.puuid)) continue;
    seen.add(p.puuid);
    rows.push({
      matchId: match.metadata.match_id,
      puuid: p.puuid,
      gameName: p.name,
      tagLine: p.tag,
      team: p.team_id,
      agentId: p.agent?.id ?? null,
      agentName: p.agent?.name ?? null,
      tier: p.tier?.id ?? null,
      kills: int(p.stats.kills),
      deaths: int(p.stats.deaths),
      assists: int(p.stats.assists),
      score: int(p.stats.score),
      damageDealt: int(p.stats.damage.dealt),
      damageReceived: int(p.stats.damage.received),
      headshots: int(p.stats.headshots),
      bodyshots: int(p.stats.bodyshots),
      legshots: int(p.stats.legshots),
      won: winningTeam !== null && p.team_id === winningTeam,
    });
  }
  return rows;
}

function attackingTeamOf(match: HenrikMatch, winningTeam: string | null, winningRole: string | null | undefined) {
  if (!winningTeam || !winningRole) return null;
  const role = winningRole.toLowerCase();
  if (role.startsWith("attack")) return winningTeam;
  if (!role.startsWith("defen")) return null;
  const teams = [...new Set(match.players.map((player) => player.team_id))];
  return teams.length === 2 ? (teams.find((team) => team !== winningTeam) ?? null) : null;
}

/** Validated round payload -> raw rows. Missing fields stay null. */
export function toRoundRows(match: HenrikMatch): NewMatchRound[] {
  return (match.rounds ?? []).map((round) => ({
    matchId: match.metadata.match_id,
    round: int(round.id),
    winningTeam: round.winning_team ?? null,
    result: round.result ?? null,
    attackingTeam: attackingTeamOf(match, round.winning_team ?? null, round.winning_team_role),
  }));
}

/** Ordered kill feed. `seq` is stable even when two kills have the same timestamp. */
export function toKillRows(match: HenrikMatch): NewMatchKill[] {
  const byRound = new Map<number, Array<{ index: number; kill: NonNullable<HenrikMatch["kills"]>[number] }>>();
  (match.kills ?? []).forEach((kill, index) => {
    const round = int(kill.round);
    const entries = byRound.get(round) ?? [];
    entries.push({ index, kill });
    byRound.set(round, entries);
  });

  return [...byRound.entries()].flatMap(([round, entries]) =>
    entries
      .sort((a, b) => a.kill.time_in_round_in_ms - b.kill.time_in_round_in_ms || a.index - b.index)
      .map(({ kill }, seq) => ({
        matchId: match.metadata.match_id,
        round,
        seq,
        timeInRoundMs: int(kill.time_in_round_in_ms),
        killerPuuid: kill.killer?.puuid || null,
        victimPuuid: kill.victim.puuid,
        assistants: (kill.assistants ?? []).map((assistant) => assistant.puuid),
        weaponId: kill.weapon?.id ?? null,
        weaponName: kill.weapon?.name ?? null,
        weaponType: kill.weapon?.type ?? null,
      })),
  );
}

export function toRoundPlayerRows(match: HenrikMatch): NewMatchRoundPlayer[] {
  const kills = match.kills;
  return (match.rounds ?? []).flatMap((round) =>
    (round.stats ?? []).map((entry) => {
      const roundKills = kills?.filter((kill) => int(kill.round) === int(round.id));
      const damage = entry.damage_events?.reduce((sum, event) => sum + (event.damage ?? 0), 0) ?? null;
      return {
        matchId: match.metadata.match_id,
        round: int(round.id),
        puuid: entry.player.puuid,
        team: entry.player.team,
        weaponId: entry.economy?.weapon?.id ?? null,
        weaponName: entry.economy?.weapon?.name ?? null,
        armor: entry.economy?.armor?.name ?? null,
        loadoutValue: entry.economy?.loadout_value == null ? null : int(entry.economy.loadout_value),
        spent: null,
        damage: damage == null ? null : int(damage),
        score: entry.stats?.score == null ? null : int(entry.stats.score),
        headshots: entry.stats?.headshots == null ? null : int(entry.stats.headshots),
        bodyshots: entry.stats?.bodyshots == null ? null : int(entry.stats.bodyshots),
        legshots: entry.stats?.legshots == null ? null : int(entry.stats.legshots),
        kills: entry.stats?.kills == null ? null : int(entry.stats.kills),
        assists:
          roundKills == null
            ? null
            : roundKills.filter((kill) => kill.assistants?.some((assistant) => assistant.puuid === entry.player.puuid)).length,
        survived: roundKills == null ? null : !roundKills.some((kill) => kill.victim.puuid === entry.player.puuid),
      };
    }),
  );
}

/**
 * MMR entries → snapshots. Entries without a match id are dropped: the
 * (puuid, match_id) unique index is what keeps re-imports idempotent.
 */
export function toSnapshotRows(puuid: string, entries: readonly HenrikMmrEntry[]): NewMmrSnapshot[] {
  return entries.flatMap((e) =>
    e.match_id
      ? [
          {
            puuid,
            tier: e.tier.id,
            tierName: e.tier.name,
            rr: int(e.rr),
            rrChange: e.last_change == null ? null : int(e.last_change),
            elo: e.elo == null ? null : int(e.elo),
            matchId: e.match_id,
            recordedAt: new Date(e.date),
          },
        ]
      : [],
  );
}
