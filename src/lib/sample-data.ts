/**
 * Fixed sample data for the /design-system showcase. All players are fictional.
 * Map and agent names are game facts; no official art is used.
 */
import type { MatchResult } from "@/lib/stats/metrics";
import type { PlayerRoundMetrics } from "@/lib/rounds";

/** Fixed "now" so relative times are deterministic (and prerender-safe). */
export const SAMPLE_NOW = new Date("2026-11-05T21:00:00-03:00");

const hoursAgo = (h: number) => new Date(SAMPLE_NOW.getTime() - h * 3_600_000);

export type SampleMatch = {
  id: string;
  result: MatchResult;
  map: string;
  mode: string;
  agent: string;
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  rounds: number;
  teamScore: number;
  enemyScore: number;
  playedAt: Date;
};

export const sampleMatches: SampleMatch[] = [
  { id: "a1f3", result: "win", map: "Ascent", mode: "Competitivo", agent: "Jett", kills: 24, deaths: 14, assists: 5, score: 6118, rounds: 22, teamScore: 13, enemyScore: 9, playedAt: hoursAgo(2) },
  { id: "b7c2", result: "loss", map: "Bind", mode: "Competitivo", agent: "Raze", kills: 15, deaths: 18, assists: 7, score: 4002, rounds: 21, teamScore: 8, enemyScore: 13, playedAt: hoursAgo(5) },
  { id: "c9d4", result: "draw", map: "Lotus", mode: "Competitivo", agent: "Omen", kills: 21, deaths: 20, assists: 11, score: 5880, rounds: 24, teamScore: 12, enemyScore: 12, playedAt: hoursAgo(26) },
  { id: "d2e8", result: "win", map: "Haven", mode: "Competitivo", agent: "Sova", kills: 18, deaths: 12, assists: 13, score: 4719, rounds: 19, teamScore: 13, enemyScore: 6, playedAt: hoursAgo(50) },
];

export type SampleKpi = {
  label: string;
  value: string;
  delta: number;
  deltaDigits?: number;
  /** Formula shown in a tooltip */
  formula: string;
  trend: number[];
};

export const sampleKpis: SampleKpi[] = [
  { label: "ACS", value: "247", delta: 12.4, formula: "score ÷ rounds jogados", trend: [212, 228, 219, 241, 236, 252, 247] },
  { label: "K/D", value: "1,24", delta: 0.08, deltaDigits: 2, formula: "kills ÷ máx(mortes, 1)", trend: [1.1, 1.05, 1.18, 1.2, 1.15, 1.3, 1.24] },
  { label: "HS%", value: "23,8%", delta: -1.6, formula: "headshots ÷ todos os acertos", trend: [26, 25, 24.5, 25.2, 23, 24, 23.8] },
  { label: "ADR", value: "158", delta: 4.1, formula: "dano causado ÷ rounds jogados", trend: [149, 151, 147, 160, 155, 162, 158] },
  { label: "Win rate", value: "55%", delta: 3, deltaDigits: 0, formula: "vitórias ÷ partidas (empates à parte)", trend: [48, 50, 51, 53, 52, 56, 55] },
];

export type SamplePlayer = {
  name: string;
  tag: string;
  agent: string;
  score: number;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  headshots: number;
  bodyshots: number;
  legshots: number;
  isYou?: boolean;
  inGroup?: boolean;
};

export type SampleTeam = {
  name: string;
  result: MatchResult;
  rounds: number;
  players: SamplePlayer[];
};

export const sampleScoreboard: { rounds: number; teams: [SampleTeam, SampleTeam] } = {
  rounds: 22,
  teams: [
    {
      name: "Time A",
      result: "win",
      rounds: 13,
      players: [
        { name: "nyx", tag: "BR1", agent: "Jett", score: 6118, kills: 24, deaths: 14, assists: 5, damage: 3830, headshots: 31, bodyshots: 72, legshots: 6, isYou: true },
        { name: "capivara", tag: "777", agent: "Sova", score: 5023, kills: 19, deaths: 15, assists: 9, damage: 3302, headshots: 22, bodyshots: 70, legshots: 9, inGroup: true },
        { name: "pastel de vento", tag: "SP11", agent: "Omen", score: 4310, kills: 16, deaths: 16, assists: 12, damage: 2870, headshots: 15, bodyshots: 64, legshots: 8, inGroup: true },
        { name: "lua", tag: "0001", agent: "Killjoy", score: 3655, kills: 13, deaths: 15, assists: 6, damage: 2440, headshots: 12, bodyshots: 58, legshots: 4 },
        { name: "tropeço", tag: "RJ21", agent: "Skye", score: 3102, kills: 10, deaths: 16, assists: 14, damage: 2101, headshots: 8, bodyshots: 49, legshots: 7 },
      ],
    },
    {
      name: "Time B",
      result: "loss",
      rounds: 9,
      players: [
        { name: "ventania", tag: "BR2", agent: "Raze", score: 5390, kills: 21, deaths: 17, assists: 4, damage: 3511, headshots: 25, bodyshots: 75, legshots: 10 },
        { name: "mandacaru", tag: "NE1", agent: "Cypher", score: 4421, kills: 17, deaths: 18, assists: 5, damage: 2950, headshots: 20, bodyshots: 61, legshots: 6 },
        { name: "orvalho", tag: "4040", agent: "Breach", score: 3880, kills: 14, deaths: 19, assists: 10, damage: 2602, headshots: 11, bodyshots: 66, legshots: 9 },
        { name: "farol", tag: "SUL", agent: "Viper", score: 3360, kills: 12, deaths: 19, assists: 8, damage: 2288, headshots: 13, bodyshots: 51, legshots: 5 },
        { name: "brisa", tag: "999", agent: "Sage", score: 2410, kills: 8, deaths: 19, assists: 11, damage: 1650, headshots: 6, bodyshots: 44, legshots: 3 },
      ],
    },
  ],
};

export type SampleRankingEntry = {
  name: string;
  tag: string;
  value: string;
  /** Change vs. last week, in metric units */
  delta: number;
  matches: number;
  isYou?: boolean;
};

export const sampleRanking: SampleRankingEntry[] = [
  { name: "capivara", tag: "777", value: "268", delta: 21, matches: 14 },
  { name: "nyx", tag: "BR1", value: "247", delta: 12, matches: 11, isYou: true },
  { name: "pastel de vento", tag: "SP11", value: "231", delta: -6, matches: 9 },
  { name: "lua", tag: "0001", value: "204", delta: 3, matches: 6 },
  { name: "tropeço", tag: "RJ21", value: "188", delta: -14, matches: 12 },
];

export type TrendPoint = {
  match: number;
  acs: number;
  kd: number;
  hs: number;
  adr: number;
  map: string;
  agent: string;
  agentId: string | null;
  result: "win" | "loss" | "draw";
  own: number;
  enemy: number;
};

const SAMPLE_MAPS = ["Ascent", "Bind", "Haven", "Lotus", "Sunset"];
const SAMPLE_AGENTS = ["Jett", "Omen", "Sova", "Killjoy"];

export const sampleTrend: TrendPoint[] = [
  212, 228, 219, 241, 236, 252, 230, 244, 261, 238, 249, 255, 233, 247, 266, 251, 243, 259, 270, 247,
].map((acsValue, i) => ({
  match: i + 1,
  acs: acsValue,
  kd: Math.round((acsValue / 200) * 100) / 100,
  hs: Math.round((18 + ((i * 7) % 11)) * 10) / 10,
  adr: Math.round(acsValue * 0.64),
  map: SAMPLE_MAPS[i % SAMPLE_MAPS.length]!,
  agent: SAMPLE_AGENTS[i % SAMPLE_AGENTS.length]!,
  agentId: null,
  result: acsValue >= 240 ? "win" : "loss",
  own: acsValue >= 240 ? 13 : 9,
  enemy: acsValue >= 240 ? 9 : 13,
}));

/** Round breakdown for the design system (shaped like a real account with ~640 rounds). */
export const sampleRoundMetrics: PlayerRoundMetrics = {
  rounds: 643,
  firstBlood: { value: 67 / 643, successes: 67, sample: 643 },
  firstDeath: { value: 48 / 643, successes: 48, sample: 643 },
  multiKills: { three: 43, four: 13, ace: 3 },
  clutch: {
    1: { situations: 9, wins: 6, rate: 6 / 9 },
    2: { situations: 14, wins: 5, rate: 5 / 14 },
    3: { situations: 16, wins: 4, rate: 4 / 16 },
    4: { situations: 19, wins: 0, rate: 0 },
    5: { situations: 6, wins: 0, rate: 0 },
  },
  kast: { value: 0.736, successes: 473, sample: 643 },
  economy: [
    { band: "pistol", wins: 27, rounds: 60, winRate: 0.45, acs: 251, acsSample: 60 },
    { band: "eco", wins: 9, rounds: 68, winRate: 9 / 68, acs: 155, acsSample: 68 },
    { band: "force", wins: 76, rounds: 152, winRate: 0.5, acs: 238, acsSample: 152 },
    { band: "full", wins: 200, rounds: 363, winRate: 200 / 363, acs: 305, acsSample: 363 },
  ],
  sides: [
    { mapName: "Abyss", mapId: "224b0a95-48b9-f703-1bd8-67aca101a61f", attack: { value: 0.489, successes: 22, sample: 45 }, defense: { value: 0.378, successes: 17, sample: 45 } },
    { mapName: "Bind", mapId: "2c9d57ec-4431-9c5e-2939-8f9ef6dd5cba", attack: { value: 0.466, successes: 27, sample: 58 }, defense: { value: 0.651, successes: 28, sample: 43 } },
    { mapName: "Haven", mapId: "2bee0dc9-4ffe-519b-1cbd-7fbe763a6047", attack: { value: 0.524, successes: 22, sample: 42 }, defense: { value: 0.514, successes: 19, sample: 37 } },
    { mapName: "Lotus", mapId: "2fe4ed3a-450a-948b-6d6b-e89a78e680a9", attack: { value: 0.425, successes: 17, sample: 40 }, defense: { value: 0.256, successes: 10, sample: 39 } },
    { mapName: "Sunset", mapId: "92584fbe-486a-b1b2-9faa-39b0f486b498", attack: { value: 0.455, successes: 5, sample: 11 }, defense: { value: 0.5, successes: 4, sample: 8 } },
  ],
  weapons: [
    { weaponId: "ee8e8d15-496b-07ac-e5f6-8fae5d4c7b1a", weaponName: "Phantom", kills: 299, headshots: 250, shots: 1000, hsRate: 0.25, shotSampleRounds: 260, matches: 30 },
    { weaponId: "9c82e19d-4575-0200-1a81-3eacf00cf872", weaponName: "Vandal", kills: 155, headshots: 130, shots: 500, hsRate: 0.26, shotSampleRounds: 140, matches: 27 },
    { weaponId: "1baa85b4-4c70-1284-64bb-6481dfc3bb4e", weaponName: "Ghost", kills: 51, headshots: 38, shots: 200, hsRate: 0.19, shotSampleRounds: 70, matches: 26 },
    { weaponId: "ae3de142-4d85-2547-dd26-4e90bed35cf7", weaponName: "Bulldog", kills: 35, headshots: 24, shots: 101, hsRate: 0.238, shotSampleRounds: 30, matches: 19 },
    { weaponId: "462080d1-4035-2937-7c09-27aa2a5c27a7", weaponName: "Spectre", kills: 22, headshots: 15, shots: 100, hsRate: 0.15, shotSampleRounds: 25, matches: 16 },
    { weaponId: "29a0cfab-485b-f5d5-779a-b59f85e204a8", weaponName: "Classic", kills: 11, headshots: 20, shots: 81, hsRate: 0.247, shotSampleRounds: 40, matches: 25 },
    { weaponId: "a03b24d3-4319-996d-0f8c-94bbfba1dfc7", weaponName: "Operator", kills: 4, headshots: 1, shots: 6, hsRate: 1 / 6, shotSampleRounds: 4, matches: 2 },
  ],
};
