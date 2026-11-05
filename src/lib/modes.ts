/** Queue ids (metadata.queue.id) → labels in pt-BR. Unknown ids fall back to the API label. */
import { ALL_MODES } from "@/lib/stats/aggregate";

const LABELS: Record<string, string> = {
  competitive: "Competitivo",
  unrated: "Sem classificação",
  swiftplay: "Partida rápida",
  spikerush: "Disputa da Spike",
  deathmatch: "Mata-mata",
  teamdeathmatch: "Mata-mata em equipe",
  premier: "Premier",
  ggteam: "Escalada",
  hurm: "Mata-mata em equipe",
  custom: "Personalizada",
  newmap: "Mapa novo",
  [ALL_MODES]: "Todos os modos",
};

export function modeLabel(queueId: string, apiLabel?: string | null): string {
  return LABELS[queueId] ?? apiLabel ?? queueId;
}

const ADJECTIVES: Record<string, string> = {
  competitive: "competitiva",
  unrated: "sem classificação",
  swiftplay: "rápida",
  [ALL_MODES]: "",
};

/** Qualifier for sentences: "nenhuma partida competitiva", "nenhuma partida de mata-mata". */
export function modeAdjective(queueId: string): string {
  return ADJECTIVES[queueId] ?? `de ${modeLabel(queueId).toLowerCase()}`;
}
