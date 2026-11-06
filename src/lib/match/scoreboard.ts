/**
 * Pure scoreboard building for the match page: groups the stored players by
 * team (viewer's team first) and marks the viewer's row.
 */
import type { matches, matchPlayers } from "@/db/schema";
import { agentIconUrl } from "@/lib/assets";
import { matchResult } from "@/lib/stats/aggregate";
import type { MatchResult } from "@/lib/stats/metrics";

type MatchRow = typeof matches.$inferSelect;
type PlayerRow = typeof matchPlayers.$inferSelect;

export interface BoardPlayer {
  id: string;
  name: string;
  tag: string;
  agent: string;
  agentIcon?: string;
  score: number;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  headshots: number;
  bodyshots: number;
  legshots: number;
  /** Competitive tier in this match (match_players.tier) */
  tier: number | null;
  isYou: boolean;
}

export interface BoardTeam {
  id: string;
  name: string;
  result: MatchResult;
  rounds: number;
  players: BoardPlayer[];
}

const TEAM_NAMES: Record<string, string> = { blue: "Azul", red: "Vermelho" };

export function teamName(teamId: string): string {
  return TEAM_NAMES[teamId.toLowerCase()] ?? teamId;
}

function roundsOf(match: MatchRow, teamId: string): number {
  const key = teamId.toLowerCase();
  if (key === "red") return match.redScore ?? 0;
  if (key === "blue") return match.blueScore ?? 0;
  return 0;
}

export interface Scoreboard {
  you: PlayerRow;
  result: MatchResult;
  own: number;
  enemy: number;
  /** One per team, viewer's first. A single entry for modes without two teams. */
  teams: BoardTeam[];
}

export function buildScoreboard(match: MatchRow, players: readonly PlayerRow[], viewerPuuid: string): Scoreboard {
  const you = players.find((p) => p.puuid === viewerPuuid);
  if (!you) throw new Error("viewer is not in this match");
  const result = matchResult({ won: you.won, winningTeam: match.winningTeam });

  const toBoard = (p: PlayerRow): BoardPlayer => ({
    id: p.puuid,
    name: p.gameName,
    tag: p.tagLine,
    agent: p.agentName ?? "Agente",
    agentIcon: agentIconUrl(p.agentId),
    score: p.score,
    kills: p.kills,
    deaths: p.deaths,
    assists: p.assists,
    damage: p.damageDealt,
    headshots: p.headshots,
    bodyshots: p.bodyshots,
    legshots: p.legshots,
    tier: p.tier,
    isYou: p.puuid === viewerPuuid,
  });

  const byTeam = new Map<string, PlayerRow[]>();
  for (const p of players) byTeam.set(p.team, [...(byTeam.get(p.team) ?? []), p]);

  // Deathmatch & co.: no two-team scoreboard, one table for everyone.
  if (byTeam.size !== 2) {
    return {
      you,
      result,
      own: you.kills,
      enemy: 0,
      teams: [{ id: "all", name: "Placar", result, rounds: match.roundsPlayed, players: players.map(toBoard) }],
    };
  }

  const teams = [...byTeam.entries()]
    .map(([id, rows]): BoardTeam => {
      const mine = id === you.team;
      const teamResult: MatchResult =
        match.winningTeam === null ? "draw" : match.winningTeam.toLowerCase() === id.toLowerCase() ? "win" : "loss";
      return {
        id,
        name: mine ? `Seu time · ${teamName(id)}` : `Adversário · ${teamName(id)}`,
        result: teamResult,
        rounds: roundsOf(match, id),
        players: rows.map(toBoard),
      };
    })
    .sort((a, b) => (a.id === you.team ? -1 : b.id === you.team ? 1 : 0));

  return { you, result, own: teams[0]!.rounds, enemy: teams[1]!.rounds, teams };
}
