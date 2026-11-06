// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";

import { AiError, resetCooldowns, type TextProvider } from "@/lib/ai";
import type { GroupLine, GroupMember } from "@/lib/groups/ranking";
import { previousWeek, weekRange } from "@/lib/groups/week";

import { buildSummaryCard } from "./card";
import { buildWeeklyStats, isEmptyWeek, type WeeklyStats } from "./stats";
import { acceptSummary, rulesSummary, writeSummary } from "./text";
import { summaryWeekDue } from "./weekly";

const week = weekRange(new Date("2026-11-05T18:00:00Z")); // 2–8 Nov
const prev = previousWeek(week);
const THIS = new Date("2026-11-04T22:00:00Z");
const LAST = new Date("2026-10-28T22:00:00Z");

const member = (id: string, extra: Partial<GroupMember> = {}): GroupMember => ({
  userId: `u-${id}`,
  puuid: `p-${id}`,
  name: id,
  tag: "BR1",
  image: null,
  role: "member",
  isYou: false,
  ...extra,
});

let seq = 0;
function line(puuid: string, over: Partial<GroupLine> = {}): GroupLine {
  seq++;
  return {
    puuid,
    matchId: `m${seq}`,
    startedAt: THIS,
    queueId: "competitive",
    mode: "Competitive",
    mapId: null,
    mapName: "Ascent",
    roundsPlayed: 20,
    winningTeam: "Blue",
    redScore: 7,
    blueScore: 13,
    team: "Blue",
    agentId: null,
    agentName: "Jett",
    won: true,
    kills: 20,
    deaths: 10,
    assists: 5,
    score: 5000, // ACS 250
    damageDealt: 3000,
    headshots: 10,
    bodyshots: 30,
    legshots: 2,
    ...over,
  };
}

const ana = member("Ana");
const bia = member("p12 o tal"); // a name with digits
const members = [ana, bia, member("Sem Riot", { puuid: null })];

function sampleLines(): GroupLine[] {
  return [
    // Together (same match id, same team), a win.
    line("p-Ana", { matchId: "t1", score: 6000 }),
    line("p-p12 o tal", { matchId: "t1", score: 4000 }),
    line("p-Ana", { score: 5400, won: false, winningTeam: "Red", mapName: "Bind" }),
    line("p-Ana", { score: 7000, mapName: "Lotus", kills: 30, deaths: 12, assists: 4 }), // best game: ACS 350
    line("p-p12 o tal", { score: 4400 }),
    line("p-p12 o tal", { score: 4800, won: false, winningTeam: null }), // draw
    line("p-p12 o tal", { queueId: "unrated" }),
    // Last week: Ana at ACS 200 → most improved.
    line("p-Ana", { startedAt: LAST, score: 4000 }),
    line("p-Ana", { startedAt: LAST, score: 4000 }),
    line("p-Ana", { startedAt: LAST, score: 4000 }),
    // A non-member in the same match: must never show up.
    line("p-stranger", { matchId: "t1", score: 9000 }),
  ];
}

const stats = (lines = sampleLines()) =>
  buildWeeklyStats({ groupName: "Os Parças", weekLabel: "2 – 8 de nov", members, lines, week, previousWeek: prev });

describe("buildWeeklyStats", () => {
  it("aggregates the week's competitive matches by code", () => {
    const s = stats();
    expect(s).toMatchObject({ partidas: 5, vitorias: 3, derrotas: 1, empates: 1, taxaVitoria: 60, partidasJuntos: 1, outrosModos: 1 });
  });

  it("names only members, MVP by the group rule, the best single game and who improved most", () => {
    const s = stats();
    expect(s.jogadores.map((j) => j.nome)).toEqual(["Ana", "p12 o tal"]);
    expect(JSON.stringify(s)).not.toContain("stranger");
    expect(s.mvp).toMatchObject({ nome: "Ana", partidas: 3 });
    expect(s.maiorPlacar).toEqual({ nome: "Ana", acs: 350, mapa: "Lotus", abates: 30, mortes: 12, assistencias: 4 });
    expect(s.maisEvoluiu).toMatchObject({ nome: "Ana", acsSemanaPassada: 200, diferenca: s.maisEvoluiu!.acsSemana - 200 });
  });

  it("knows an empty week", () => {
    expect(isEmptyWeek(stats([]))).toBe(true);
    expect(isEmptyWeek(stats([line("p-Ana", { queueId: "unrated" })]))).toBe(false);
  });
});

describe("acceptSummary", () => {
  const s = stats();
  const ok = `Semana movimentada no Os Parças: 5 competitivas, 3 vitórias e 1 derrota. Ana foi MVP e fez 350 de ACS em Lotus, e p12 o tal segurou as pontas.`;

  it("accepts a text whose numbers are all in the data (names with digits don't count)", () => {
    expect(acceptSummary(ok, s)).toBe(ok);
    expect(acceptSummary(`"${ok}"`, s)).toBe(ok);
  });

  it("rejects invented numbers", () => {
    expect(acceptSummary(ok.replace("350", "420"), s)).toBeNull();
    expect(acceptSummary(`${ok} Foram 8 clutches.`, s)).toBeNull();
  });

  it("rejects texts that are too short, too long, or carry code, JSON, links or mass mentions", () => {
    expect(acceptSummary("GG.", s)).toBeNull();
    expect(acceptSummary(ok.repeat(10), s)).toBeNull();
    expect(acceptSummary(`${ok} {"partidas": 5}`, s)).toBeNull();
    expect(acceptSummary(`${ok} https://exemplo.com`, s)).toBeNull();
    expect(acceptSummary(`${ok} @everyone`, s)).toBeNull();
  });
});

describe("rulesSummary", () => {
  it("only uses the data and passes its own check", () => {
    const s = stats();
    const text = rulesSummary(s);
    expect(text).toContain("5 ");
    expect(text).toContain("Ana");
    expect(acceptSummary(text, s)).toBe(text);
  });

  it("varies the wording between weeks (seeds)", () => {
    const s = stats();
    const texts = new Set(Array.from({ length: 12 }, (_, i) => rulesSummary(s, i)));
    expect(texts.size).toBeGreaterThan(3);
  });

  it("handles a week with only other modes, and one without MVP", () => {
    const other = stats([line("p-Ana", { queueId: "unrated" })]);
    expect(rulesSummary(other)).toMatch(/sem competitiva .* rolou 1 partida em outros modos/);
    const noMvp = stats([line("p-Ana")]);
    expect(rulesSummary(noMvp)).toContain("ficou sem MVP");
  });
});

describe("writeSummary (fallback chain)", () => {
  beforeEach(() => resetCooldowns());
  const s: WeeklyStats = stats();
  const good = `Semana boa no Os Parças: 5 competitivas e 3 vitórias. Ana levou o MVP com 350 de ACS na melhor partida, em Lotus.`;

  const fake = (id: "gemini" | "groq", behaviour: "ok" | "invent" | AiError): TextProvider => ({
    id,
    model: `${id}-free`,
    async generate() {
      if (behaviour instanceof AiError) throw behaviour;
      return behaviour === "ok" ? good : good.replace("350", "999");
    },
  });

  it("(a) Gemini writes it when it answers", async () => {
    const r = await writeSummary(s, [fake("gemini", "ok"), fake("groq", "ok")]);
    expect(r).toMatchObject({ provider: "gemini", model: "gemini-free", text: good });
  });

  it.each([
    ["times out", new AiError("gemini", "timeout")],
    ["is rate limited (429)", new AiError("gemini", "rate_limited", 429, 60_000)],
    ["is down (503)", new AiError("gemini", "http", 503)],
    ["has a bad key", new AiError("gemini", "auth", 401)],
  ])("(b) Groq writes it when Gemini %s", async (_, error) => {
    const r = await writeSummary(s, [fake("gemini", error), fake("groq", "ok")]);
    expect(r).toMatchObject({ provider: "groq", model: "groq-free" });
    expect(r.attempts.map((a) => a.provider)).toEqual(["gemini", "groq"]);
  });

  it("(b) Groq writes it when Gemini invents a number", async () => {
    const r = await writeSummary(s, [fake("gemini", "invent"), fake("groq", "ok")]);
    expect(r.provider).toBe("groq");
    expect(r.attempts[0]?.outcome).toBe("rejected");
  });

  it("(c) rules write it when both fail", async () => {
    const r = await writeSummary(s, [fake("gemini", new AiError("gemini", "timeout")), fake("groq", new AiError("groq", "rate_limited", 429))]);
    expect(r).toMatchObject({ provider: "rules", model: null });
    expect(r.text).toBe(rulesSummary(s));
  });

  it("(c) rules write it when there are no keys", async () => {
    const r = await writeSummary(s, []);
    expect(r.provider).toBe("rules");
    expect(r.attempts).toEqual([]);
  });
});

describe("summary card and schedule", () => {
  it("says who wrote the text and never pings anyone", () => {
    const s = stats();
    const card = buildSummaryCard({ stats: s, text: "Texto.", provider: "groq", model: "openai/gpt-oss-120b", groupUrl: "https://app/groups/x" });
    expect(card.allowed_mentions).toEqual({ parse: [] });
    expect(card.embeds[0]!.title).toBe("Resumo da semana · Os Parças");
    expect(card.embeds[0]!.footer!.text).toContain("Groq · openai/gpt-oss-120b");
    expect(card.embeds[0]!.fields!.map((f) => f.name)).toEqual(["Competitivas", "MVP", "Maior placar", "Quem mais evoluiu"]);
    expect(buildSummaryCard({ stats: s, text: "Texto.", provider: "rules", model: null }).embeds[0]!.footer!.text).toContain("regras");
  });

  it("is due from Monday 09:00 São Paulo, for the week that ended", () => {
    expect(summaryWeekDue(new Date("2026-11-09T11:59:00Z"))).toBeNull(); // Mon 08:59 SP
    const due = summaryWeekDue(new Date("2026-11-09T12:00:00Z")); // Mon 09:00 SP
    expect(due?.start.toISOString()).toBe(week.start.toISOString());
    expect(summaryWeekDue(new Date("2026-11-14T12:00:00Z"))?.start.toISOString()).toBe(week.start.toISOString());
  });
});
