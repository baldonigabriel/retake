/**
 * Fixed sample data for the /design-system showcase. All players are fictional.
 * Map and agent names are game facts; no official art is used.
 */
import type { MatchResult } from "@/lib/stats/metrics";

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

export type TrendPoint = { match: number; acs: number; kd: number; hs: number; adr: number };

export const sampleTrend: TrendPoint[] = [
  212, 228, 219, 241, 236, 252, 230, 244, 261, 238, 249, 255, 233, 247, 266, 251, 243, 259, 270, 247,
].map((acsValue, i) => ({
  match: i + 1,
  acs: acsValue,
  kd: Math.round((acsValue / 200) * 100) / 100,
  hs: Math.round((18 + ((i * 7) % 11)) * 10) / 10,
  adr: Math.round(acsValue * 0.64),
}));
