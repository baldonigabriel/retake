/**
 * Fixed, fictional data for the landing previews. Map and agent ids are the
 * community-asset uuids (media.valorant-api.com), so icons render like in the
 * app. Nothing here is a real player.
 */
import type { MatchRowData } from "@/components/match/match-row";
import type { RankingEntry } from "@/components/groups/ranking-list";
import { agentIconUrl } from "@/lib/assets";
import { buildMatchCard, type CardMatch, type CardPlayer } from "@/lib/discord/card";

/** Fixed "now" so relative times never change between renders. */
export const LANDING_NOW = new Date("2026-11-05T22:40:00-03:00");

const AGENT = {
  jett: "add6443a-41bd-e414-f6ad-e58d267f4e95",
  sova: "320b2a48-4d9b-a075-30f1-1f93a9b638fa",
  omen: "8e253930-4c05-31dd-1b6c-968525494517",
  raze: "f94c3b30-42be-e959-889c-5aa313dba261",
  killjoy: "1e58de9c-4950-5125-93e9-a0aee9f98746",
  sage: "569fdd95-4d10-43ab-ca70-79becc718b46",
  cypher: "117ed9e3-49f3-6512-3ccf-0cada7e3823b",
  viper: "707eab51-4836-f488-046a-cda6bf494859",
  phoenix: "eb93336a-449b-9c1b-0a54-a891f7921d69",
  brimstone: "9f0d8ba9-4140-b941-57d3-a7ad57c6b417",
} as const;

const ASCENT = "7eaecc1b-4337-bbf6-6ab9-04b8f06b3319";

const hoursAgo = (h: number) => new Date(LANDING_NOW.getTime() - h * 3_600_000);

export const landingMatches: MatchRowData[] = [
  { id: "l1", result: "win", map: "Ascent", mode: "Competitivo", agent: "Jett", agentIcon: agentIconUrl(AGENT.jett), kills: 24, deaths: 14, assists: 5, score: 5302, rounds: 22, teamScore: 13, enemyScore: 9, playedAt: hoursAgo(0.3) },
  { id: "l2", result: "loss", map: "Bind", mode: "Competitivo", agent: "Raze", agentIcon: agentIconUrl(AGENT.raze), kills: 15, deaths: 18, assists: 7, score: 4002, rounds: 21, teamScore: 8, enemyScore: 13, playedAt: hoursAgo(2) },
  { id: "l3", result: "win", map: "Haven", mode: "Competitivo", agent: "Sova", agentIcon: agentIconUrl(AGENT.sova), kills: 18, deaths: 12, assists: 13, score: 4719, rounds: 19, teamScore: 13, enemyScore: 6, playedAt: hoursAgo(26) },
];

export const landingKpis = [
  { label: "ACS", value: "247", delta: 12.4, trend: [212, 228, 219, 241, 236, 252, 247] },
  { label: "K/D", value: "1,24", delta: 0.08, deltaDigits: 2, trend: [1.1, 1.05, 1.18, 1.2, 1.15, 1.3, 1.24] },
  { label: "HS%", value: "23,8%", delta: -1.6, trend: [26, 25, 24.5, 25.2, 23, 24, 23.8] },
  { label: "Win rate", value: "55%", delta: 3, deltaDigits: 0, trend: [48, 50, 51, 53, 52, 56, 55] },
] as const;

export const landingRanking: RankingEntry[] = [
  { id: "capivara", name: "capivara", tag: "777", value: "268", delta: 21, matches: 14, detail: "14 partidas · 9V 5D" },
  { id: "nyx", name: "nyx", tag: "BR1", value: "247", delta: 12, matches: 11, detail: "11 partidas · 6V 5D", isYou: true },
  { id: "pastel", name: "pastel de vento", tag: "SP11", value: "231", delta: -6, matches: 9, detail: "9 partidas · 4V 4D 1E" },
  { id: "lua", name: "lua", tag: "0001", value: "204", delta: 3, matches: 6, detail: "6 partidas · 3V 3D" },
  { id: "tropeco", name: "tropeço", tag: "RJ21", value: "188", delta: -14, matches: 12, detail: "12 partidas · 5V 7D" },
];

const match: CardMatch = {
  id: "landing-ascent",
  mapId: ASCENT,
  mapName: "Ascent",
  queueId: "competitive",
  mode: "Competitive",
  startedAt: new Date(LANDING_NOW.getTime() - 54 * 60_000),
  gameLengthMs: 2_154_000,
  roundsPlayed: 22,
  redScore: 13,
  blueScore: 9,
  winningTeam: "Red",
};

const p = (puuid: string, gameName: string, team: string, agent: keyof typeof AGENT, s: Partial<CardPlayer>): CardPlayer => ({
  puuid,
  gameName,
  team,
  agentId: AGENT[agent],
  agentName: agent[0]!.toUpperCase() + agent.slice(1),
  kills: 15,
  deaths: 15,
  assists: 6,
  score: 3800,
  damageDealt: 2900,
  headshots: 14,
  bodyshots: 60,
  legshots: 6,
  won: team === "Red",
  ...s,
});

const players: CardPlayer[] = [
  p("nyx", "nyx", "Red", "jett", { kills: 24, deaths: 14, assists: 5, score: 5302, damageDealt: 3476, headshots: 31, bodyshots: 92, legshots: 7 }),
  p("capivara", "capivara", "Red", "sova", { kills: 19, deaths: 15, assists: 9, score: 4620, damageDealt: 3102, headshots: 20, bodyshots: 70, legshots: 9 }),
  p("r3", "—", "Red", "omen", { score: 3900 }),
  p("r4", "—", "Red", "killjoy", { score: 3300 }),
  p("r5", "—", "Red", "sage", { score: 2800 }),
  p("b1", "—", "Blue", "raze", { score: 5390 }),
  p("b2", "—", "Blue", "cypher", { score: 4400 }),
  p("b3", "—", "Blue", "viper", { score: 3600 }),
  p("b4", "—", "Blue", "phoenix", { score: 3300 }),
  p("b5", "—", "Blue", "brimstone", { score: 2400 }),
];

/** The exact payload the real sync would post for this match. */
export const landingCard = buildMatchCard({
  match,
  players,
  memberPuuids: ["nyx", "capivara"],
  groupName: "Os Parças",
});
