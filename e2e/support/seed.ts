/**
 * Test data for e2e and visual checks. Everything is synthetic (made-up
 * players, prefixed ids) and removed by `cleanup()`. Map and agent ids are
 * the real community-asset uuids so icons render like in production.
 *
 * Sessions are created with Better Auth's test-utils plugin on a test-only
 * instance (same secret and database as the dev server), because the
 * Discord OAuth screen can't be automated.
 */
import { loadEnvConfig } from "@next/env";
import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import { inArray, like } from "drizzle-orm";

import { db } from "@/db";
import {
  groupMembers,
  groups,
  matches,
  matchPlayers,
  mmrSnapshots,
  riotAccounts,
  users,
  type NewMatch,
  type NewMatchPlayer,
} from "@/db/schema";
import { serverEnv } from "@/env";
import { authOptions } from "@/lib/auth/options";
import { weekRange } from "@/lib/groups/week";

loadEnvConfig(process.cwd(), true, { info: () => {}, error: console.error });

export const E2E = {
  userId: "e2e-user",
  newUserId: "e2e-new-user",
  emptyUserId: "e2e-empty-user",
  friendUserId: "e2e-friend-user",
  puuid: "e2e-puuid-0001",
  friendPuuid: "e2e-puuid-friend",
  friendName: "Parceiro",
  /** Seeded group: Tester (owner) + Parceiro. "Vazio" is the outsider. */
  groupSlug: "e2e-squad",
  groupName: "Esquadrão E2E",
  groupInvite: "e2eSquadInviteCode000001",
  emptyPuuid: "e2e-puuid-empty",
  gameName: "Tester",
  tagLine: "E2E",
  matchPrefix: "e2e-match-",
} as const;

const MAPS = [
  { id: "7eaecc1b-4337-bbf6-6ab9-04b8f06b3319", name: "Ascent" },
  { id: "2c9d57ec-4431-9c5e-2939-8f9ef6dd5cba", name: "Bind" },
  { id: "2bee0dc9-4ffe-519b-1cbd-7fbe763a6047", name: "Haven" },
  { id: "2fe4ed3a-450a-948b-6d6b-e89a78e680a9", name: "Lotus" },
  { id: "92584fbe-486a-b1b2-9faa-39b0f486b498", name: "Sunset" },
] as const;

const AGENTS = [
  { id: "add6443a-41bd-e414-f6ad-e58d267f4e95", name: "Jett" },
  { id: "569fdd95-4d10-43ab-ca70-79becc718b46", name: "Sage" },
  { id: "8e253930-4c05-31dd-1b6c-968525494517", name: "Omen" },
  { id: "320b2a48-4d9b-a075-30f1-1f93a9b638fa", name: "Sova" },
  { id: "1e58de9c-4950-5125-93e9-a0aee9f98746", name: "Killjoy" },
  { id: "f94c3b30-42be-e959-889c-5aa313dba261", name: "Raze" },
  { id: "eb93336a-449b-9c1b-0a54-a891f7921d69", name: "Phoenix" },
  { id: "9f0d8ba9-4140-b941-57d3-a7ad57c6b417", name: "Brimstone" },
  { id: "117ed9e3-49f3-6512-3ccf-0cada7e3823b", name: "Cypher" },
  { id: "707eab51-4836-f488-046a-cda6bf494859", name: "Viper" },
] as const;

/** Real act ids (valorant-api.com): the newest matches are in Act VI, older ones in Act V. */
export const SEASONS = { current: "d816f426-48ea-f052-117f-9697a155b319", previous: "8102cd81-43a0-d0d7-bd59-47b8fe9bed1b" } as const;
/** A competitive match the RR history doesn't cover: the UI shows "—". */
export const NO_RR_MATCH = 3;

/** Deterministic pseudo-random numbers so screenshots are stable. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export const MATCH_COUNT = 26;
/** Base matches where Parceiro is on Tester's team. */
export const FRIEND_MATCHES: readonly number[] = [1, 2, 3, 4];
/** Extra competitive matches inside the current São Paulo week, Tester + Parceiro together. */
export const WEEK_MATCH_COUNT = 3;
export const weekMatchId = (i: number) => `${E2E.matchPrefix}w${i}`;
export const matchId = (i: number) => `${E2E.matchPrefix}${String(i).padStart(2, "0")}`;

export function buildMatches(now = new Date()) {
  const rand = rng(42);
  const between = (min: number, max: number) => Math.round(min + rand() * (max - min));
  const matchRows: NewMatch[] = [];
  const playerRows: NewMatchPlayer[] = [];

  for (let i = 0; i < MATCH_COUNT; i++) {
    const id = matchId(i);
    const map = MAPS[i % MAPS.length]!;
    // The two oldest are unrated and older than 30 days (empty filter state).
    const queueId = i >= MATCH_COUNT - 2 ? "unrated" : "competitive";
    // i = 0 is the newest. A slow upward trend in the recent matches.
    const form = i < 20 ? 1.08 : 0.94;
    const draw = i === 5;
    const userWon = !draw && rand() < (i < 20 ? 0.58 : 0.42);
    const winnerRounds = 13;
    const loserRounds = between(4, 11);
    const blueWon = rand() < 0.5;
    const userTeam = blueWon === userWon ? "Blue" : "Red";
    const blue = draw ? 12 : blueWon ? winnerRounds : loserRounds;
    const red = draw ? 12 : blueWon ? loserRounds : winnerRounds;
    const rounds = blue + red;

    matchRows.push({
      id,
      mapId: map.id,
      mapName: map.name,
      mode: queueId === "competitive" ? "Competitive" : "Unrated",
      queueId,
      seasonId: i < 12 ? SEASONS.current : SEASONS.previous,
      startedAt: new Date(now.getTime() - (i * 26 + 3 + (i >= 22 ? 20 * 24 : 0)) * 3_600_000),
      gameLengthMs: (rounds * 95 + between(-60, 120)) * 1000,
      roundsPlayed: rounds,
      blueScore: blue,
      redScore: red,
      winningTeam: draw ? null : blueWon ? "Blue" : "Red",
    });

    for (let p = 0; p < 10; p++) {
      const isUser = p === 0;
      const isFriend = p === 1 && FRIEND_MATCHES.includes(i);
      const team = p < 5 ? userTeam : userTeam === "Blue" ? "Red" : "Blue";
      // Parceiro is strong (stays the MVP whatever weekday the suite runs);
      // rand() is still drawn so the other players' numbers don't change.
      const other = isUser ? 0 : 0.8 + rand() * 0.45;
      const skill = isUser ? form : isFriend ? 1.6 : other;
      const kills = Math.max(2, Math.round((rounds * 0.72 * skill) + between(-4, 4)));
      const deaths = Math.max(3, Math.round(rounds * 0.68 + between(-4, 4)));
      const hits = kills * between(3, 5);
      const headshots = Math.round(hits * (isUser ? 0.22 * form : 0.12 + rand() * 0.14));
      const agent = isUser ? AGENTS[[0, 0, 1, 2, 0, 3][i % 6]!]! : AGENTS[(p + i) % AGENTS.length]!;
      playerRows.push({
        matchId: id,
        puuid: isUser ? E2E.puuid : isFriend ? E2E.friendPuuid : `e2e-puuid-${String(i).padStart(2, "0")}-${p}`,
        gameName: isUser ? E2E.gameName : isFriend ? E2E.friendName : `Jogador ${p}`,
        tagLine: isUser || isFriend ? E2E.tagLine : "XYZ",
        team,
        agentId: agent.id,
        agentName: agent.name,
        tier: 16,
        kills,
        deaths,
        assists: between(2, 9),
        score: Math.round(kills * 205 + between(300, 1800)),
        damageDealt: Math.round(kills * 140 + between(200, 900)),
        damageReceived: Math.round(deaths * 140 + between(100, 600)),
        headshots,
        bodyshots: hits - headshots - 2,
        legshots: 2,
        won: !draw && team === (blueWon ? "Blue" : "Red"),
      });
    }
  }
  return { matchRows, playerRows };
}

/**
 * Matches inside the current week (Monday 00:00 São Paulo → now), so the
 * group ranking and MVP are deterministic whatever day the suite runs.
 * Parceiro has a much higher ACS than Tester: Parceiro is the MVP.
 */
export function buildWeekMatches(now = new Date()) {
  const { start } = weekRange(now);
  const span = now.getTime() - start.getTime();
  const matchRows: NewMatch[] = [];
  const playerRows: NewMatchPlayer[] = [];
  for (let i = 0; i < WEEK_MATCH_COUNT; i++) {
    const id = weekMatchId(i);
    const map = MAPS[(i + 2) % MAPS.length]!;
    const rounds = 20;
    matchRows.push({
      id,
      mapId: map.id,
      mapName: map.name,
      mode: "Competitive",
      queueId: "competitive",
      seasonId: SEASONS.current,
      startedAt: new Date(start.getTime() + Math.floor((span * (i + 1)) / (WEEK_MATCH_COUNT + 1))),
      gameLengthMs: rounds * 95_000,
      roundsPlayed: rounds,
      blueScore: 13,
      redScore: 7,
      winningTeam: "Blue",
    });
    for (let p = 0; p < 10; p++) {
      const who = p === 0 ? "user" : p === 1 ? "friend" : "other";
      const kills = who === "friend" ? 26 : who === "user" ? 16 : 12;
      const agent = AGENTS[(p + i) % AGENTS.length]!;
      playerRows.push({
        matchId: id,
        puuid: who === "user" ? E2E.puuid : who === "friend" ? E2E.friendPuuid : `e2e-puuid-w${i}-${p}`,
        gameName: who === "user" ? E2E.gameName : who === "friend" ? E2E.friendName : `Jogador ${p}`,
        tagLine: who === "other" ? "XYZ" : E2E.tagLine,
        team: p < 5 ? "Blue" : "Red",
        agentId: agent.id,
        agentName: agent.name,
        tier: 16,
        kills,
        deaths: 12,
        assists: 4,
        score: who === "friend" ? 8000 : who === "user" ? 5000 : 4000, // ACS 400 / 250 / 200
        damageDealt: kills * 150,
        damageReceived: 1800,
        headshots: 10,
        bodyshots: 30,
        legshots: 2,
        won: p < 5,
      });
    }
  }
  return { matchRows, playerRows };
}

function testAuth() {
  return betterAuth({ ...authOptions(db(), serverEnv()), plugins: [testUtils()] });
}

/** Removes everything the seed created (safe to run twice). */
export async function cleanup() {
  const database = db();
  await database.delete(matches).where(like(matches.id, `${E2E.matchPrefix}%`));
  await database.delete(mmrSnapshots).where(like(mmrSnapshots.puuid, "e2e-%"));
  await database.delete(riotAccounts).where(like(riotAccounts.puuid, "e2e-%"));
  // Groups owned by these users (seeded or created by tests) go with them (cascade).
  await database
    .delete(users)
    .where(inArray(users.id, [E2E.userId, E2E.newUserId, E2E.emptyUserId, E2E.friendUserId]));
}

export type SeededSession = { name: string; value: string };

/** Creates the test users, linked accounts, matches, rank history and a group. */
export async function seed(): Promise<{
  onboarded: SeededSession;
  fresh: SeededSession;
  empty: SeededSession;
  friend: SeededSession;
}> {
  await cleanup();
  const database = db();
  const ctx = await testAuth().$context;
  const now = new Date();

  for (const [id, name] of [
    [E2E.userId, "Tester"],
    [E2E.newUserId, "Novato"],
    [E2E.emptyUserId, "Vazio"],
    [E2E.friendUserId, "Parceiro"],
  ] as const) {
    await ctx.test.saveUser(ctx.test.createUser({ id, name, email: `${id}@retake.example`, emailVerified: true }));
  }

  await database.insert(riotAccounts).values({
    userId: E2E.userId,
    puuid: E2E.puuid,
    gameName: E2E.gameName,
    tagLine: E2E.tagLine,
    linkedAt: new Date(now.getTime() - 30 * 24 * 3_600_000),
    lastSyncedAt: new Date(now.getTime() - 4 * 60_000),
    lastMatchAt: new Date(now.getTime() - 3 * 3_600_000),
    syncStatus: "ok",
  });

  // Linked, synced, but no matches yet (dashboard empty state).
  await database.insert(riotAccounts).values({
    userId: E2E.emptyUserId,
    puuid: E2E.emptyPuuid,
    gameName: "Vazio",
    tagLine: "E2E",
    linkedAt: new Date(now.getTime() - 3_600_000),
    lastSyncedAt: new Date(now.getTime() - 10 * 60_000),
    syncStatus: "ok",
  });

  await database.insert(riotAccounts).values({
    userId: E2E.friendUserId,
    puuid: E2E.friendPuuid,
    gameName: E2E.friendName,
    tagLine: E2E.tagLine,
    linkedAt: new Date(now.getTime() - 10 * 24 * 3_600_000),
    lastSyncedAt: new Date(now.getTime() - 6 * 60_000),
    syncStatus: "ok",
  });

  const { matchRows, playerRows } = buildMatches(now);
  const week = buildWeekMatches(now);
  await database.insert(matches).values([...matchRows, ...week.matchRows]);
  await database.insert(matchPlayers).values([...playerRows, ...week.playerRows]);

  const [squad] = await database
    .insert(groups)
    .values({ name: E2E.groupName, slug: E2E.groupSlug, ownerId: E2E.userId, inviteCode: E2E.groupInvite })
    .returning({ id: groups.id });
  await database.insert(groupMembers).values([
    { groupId: squad!.id, userId: E2E.userId, role: "owner", joinedAt: new Date(now.getTime() - 7 * 86_400_000) },
    { groupId: squad!.id, userId: E2E.friendUserId, role: "member", joinedAt: new Date(now.getTime() - 6 * 86_400_000) },
  ]);

  // Rank history for the competitive matches: Platinum 3 → Diamond 1.
  let rr = 40;
  let tier = 17;
  const allRows = [...playerRows, ...week.playerRows];
  const snapshots = [...matchRows, ...week.matchRows]
    .filter((m) => m.queueId === "competitive")
    .sort((a, b) => (a.startedAt as Date).getTime() - (b.startedAt as Date).getTime())
    .map((m) => {
      const line = allRows.find((p) => p.matchId === m.id && p.puuid === E2E.puuid)!;
      const change = m.winningTeam === null ? 0 : line.won ? 21 : -16;
      rr += change;
      if (rr >= 100) [tier, rr] = [tier + 1, rr - 100];
      if (rr < 0) [tier, rr] = [tier - 1, rr + 100];
      const names: Record<number, string> = { 16: "Platinum 2", 17: "Platinum 3", 18: "Diamond 1", 19: "Diamond 2" };
      return {
        puuid: E2E.puuid,
        tier,
        tierName: names[tier] ?? "Diamond 1",
        rr,
        rrChange: change,
        elo: tier * 100 + rr - 300,
        matchId: m.id,
        recordedAt: m.startedAt as Date,
      };
    });
  await database.insert(mmrSnapshots).values(snapshots.filter((snap) => snap.matchId !== matchId(NO_RR_MATCH)));

  const login = async (userId: string) => {
    const { cookies } = await ctx.test.login({ userId });
    const cookie = cookies.find((c) => c.name.endsWith("session_token"));
    if (!cookie) throw new Error("test-utils login returned no session cookie");
    return { name: cookie.name, value: cookie.value };
  };
  return {
    onboarded: await login(E2E.userId),
    fresh: await login(E2E.newUserId),
    empty: await login(E2E.emptyUserId),
    friend: await login(E2E.friendUserId),
  };
}
