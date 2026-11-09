import { Check, ChevronDown, X } from "lucide-react";

import { economyBand, type KillSample, type RoundContext, type RoundPlayerSample } from "@/lib/rounds";
import { cn } from "@/lib/utils";

const BUY_LABEL = { pistol: "Pistol", eco: "Eco", force: "Parcial / force", full: "Completa" } as const;

export function RoundTimeline({
  rounds,
  players,
  kills,
  viewerPuuid,
  names,
}: {
  rounds: readonly RoundContext[];
  players: readonly RoundPlayerSample[];
  kills: readonly KillSample[];
  viewerPuuid: string;
  names: ReadonlyMap<string, string>;
}) {
  const viewer = players.find((row) => row.puuid === viewerPuuid);
  if (!viewer || rounds.length === 0) return null;
  const ordered = [...rounds].sort((a, b) => a.round - b.round);

  return (
    <section aria-labelledby="round-timeline-title" className="overflow-hidden rounded-card bg-surface-1 shadow-hairline">
      <header className="border-b border-line px-4 py-3">
        <h2 id="round-timeline-title" className="text-body-sm font-semibold text-fg">Round a round</h2>
        <p className="text-label font-normal text-fg-muted">Abra um round para ver os abates na ordem.</p>
      </header>
      <div className="overflow-x-auto p-3" tabIndex={0} role="region" aria-label="Faixa de rounds da partida">
        <ol className="flex min-w-max gap-2">
          {ordered.map((round) => {
            const roundPlayers = players.filter((row) => row.round === round.round && row.matchId === round.matchId);
            const me = roundPlayers.find((row) => row.puuid === viewerPuuid);
            if (!me) return null;
            const teammates = roundPlayers.filter((row) => row.team === me.team);
            const complete = teammates.length > 0 && teammates.every((row) => row.loadoutValue !== null);
            const average = complete ? teammates.reduce((sum, row) => sum + row.loadoutValue!, 0) / teammates.length : null;
            const band = average === null ? null : economyBand(round.round, average);
            const won = round.winningTeam === me.team;
            const side = round.attackingTeam ? (round.attackingTeam === me.team ? "ATQ" : "DEF") : "lado —";
            const feed = kills
              .filter((kill) => kill.matchId === round.matchId && kill.round === round.round)
              .sort((a, b) => a.timeInRoundMs - b.timeInRoundMs || a.seq - b.seq);
            return (
              <li key={round.round} className="w-48 shrink-0">
                <details className="group rounded-control bg-surface-2 shadow-hairline open:bg-surface-3">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                    <span className={cn("inline-flex size-5 items-center justify-center rounded-chip", won ? "bg-win-tint text-win" : "bg-loss-tint text-loss")}>
                      {won ? <Check aria-hidden="true" className="size-3.5" /> : <X aria-hidden="true" className="size-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-label font-medium text-fg">Round {round.round + 1} · {won ? "Vitória" : "Derrota"}</span>
                      <span className="block truncate text-label font-normal text-fg-muted">{side} · {band ? BUY_LABEL[band] : "compra —"}</span>
                    </span>
                    <ChevronDown aria-hidden="true" className="size-4 text-fg-muted group-open:rotate-180" />
                  </summary>
                  <div className="border-t border-line px-3 py-2">
                    {feed.length === 0 ? (
                      <p className="text-label text-fg-muted">Sem abates registrados.</p>
                    ) : (
                      <ol className="space-y-1.5">
                        {feed.map((kill) => (
                          <li key={kill.seq} className="text-label text-fg-secondary">
                            <span className="font-medium text-fg">{kill.killerPuuid ? (names.get(kill.killerPuuid) ?? "Jogador") : "Ambiente"}</span>
                            {" → "}{names.get(kill.victimPuuid) ?? "Jogador"}
                            <span className="block text-fg-muted">{kill.weaponName ?? "arma desconhecida"} · {Math.floor(kill.timeInRoundMs / 1000)}s</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </details>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
