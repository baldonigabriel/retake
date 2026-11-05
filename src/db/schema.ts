/**
 * Drizzle schema (docs/SPEC.md §2).
 *
 * - Players are keyed by puuid everywhere; names and tags are snapshots.
 * - Riot ids (match ids, puuids, agent/map ids) are stored as text: they look
 *   like UUIDs but that isn't guaranteed by the API.
 * - Metrics (ACS, K/D, ...) are never stored: they are computed from the raw
 *   match_players columns by src/lib/stats.
 * - Better Auth tables (users, sessions, accounts, verifications) follow the
 *   field names of Better Auth's core schema; the Drizzle adapter maps them by
 *   their JS keys, so the SQL columns stay snake_case like the rest.
 */
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const syncStatus = pgEnum("sync_status", ["ok", "error", "pending"]);
export const groupRole = pgEnum("group_role", ["owner", "member"]);

/* ---------------------------------------------------------------- auth -- */

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamptz("expires_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

/** OAuth links (Discord). Tokens are never returned by Better Auth's API. */
export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamptz("access_token_expires_at"),
    refreshTokenExpiresAt: timestamptz("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [index("accounts_user_id_idx").on(t.userId)],
);

/** OAuth state / PKCE verifiers. */
export const verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamptz("expires_at").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

/* ---------------------------------------------------------------- game -- */

export const riotAccounts = pgTable("riot_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  /**
   * Owner. Nullable until the account is claimed in onboarding; accounts
   * synced from the terminal (sync:once) have none. Unique: one Riot account
   * per user. Deleting the user releases the account (matches are shared).
   */
  userId: text("user_id")
    .unique()
    .references(() => users.id, { onDelete: "set null" }),
  puuid: text("puuid").notNull().unique(),
  gameName: text("game_name").notNull(),
  tagLine: text("tag_line").notNull(),
  /** URL affinity used for API calls ("br"), not the Riot shard. */
  region: text("region").notNull().default("br"),
  platform: text("platform").notNull().default("pc"),
  cardUrl: text("card_url"),
  lastSyncedAt: timestamptz("last_synced_at"),
  lastMatchAt: timestamptz("last_match_at"),
  syncStatus: syncStatus("sync_status").notNull().default("pending"),
  syncError: text("sync_error"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
});

export const matches = pgTable(
  "matches",
  {
    /** Riot match id. Each match is stored once, shared by every player in it. */
    id: text("id").primaryKey(),
    mapId: text("map_id"),
    mapName: text("map_name"),
    /** Display label from the API ("Competitive"). */
    mode: text("mode"),
    /** Stable queue key ("competitive", "unrated", ...). Filters use this. */
    queueId: text("queue_id").notNull(),
    seasonId: text("season_id"),
    startedAt: timestamptz("started_at").notNull(),
    gameLengthMs: integer("game_length_ms"),
    roundsPlayed: integer("rounds_played").notNull(),
    redScore: integer("red_score"),
    blueScore: integer("blue_score"),
    /** "Red" | "Blue"; null on a draw (or modes without teams). */
    winningTeam: text("winning_team"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [index("matches_started_at_idx").on(t.startedAt)],
);

export const matchPlayers = pgTable(
  "match_players",
  {
    matchId: text("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    puuid: text("puuid").notNull(),
    gameName: text("game_name").notNull(),
    tagLine: text("tag_line").notNull(),
    team: text("team").notNull(),
    agentId: text("agent_id"),
    agentName: text("agent_name"),
    /** Competitive tier id at match time (0 = unranked). */
    tier: integer("tier"),
    kills: integer("kills").notNull(),
    deaths: integer("deaths").notNull(),
    assists: integer("assists").notNull(),
    score: integer("score").notNull(),
    damageDealt: integer("damage_dealt").notNull(),
    damageReceived: integer("damage_received").notNull(),
    headshots: integer("headshots").notNull(),
    bodyshots: integer("bodyshots").notNull(),
    legshots: integer("legshots").notNull(),
    won: boolean("won").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.matchId, t.puuid] }),
    index("match_players_puuid_match_idx").on(t.puuid, t.matchId),
  ],
);

export const mmrSnapshots = pgTable(
  "mmr_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    puuid: text("puuid").notNull(),
    tier: integer("tier").notNull(),
    tierName: text("tier_name").notNull(),
    rr: integer("rr").notNull(),
    rrChange: integer("rr_change"),
    elo: integer("elo"),
    /** No FK: MMR history goes further back than the matches we store. */
    matchId: text("match_id"),
    recordedAt: timestamptz("recorded_at").notNull(),
  },
  (t) => [
    index("mmr_snapshots_puuid_recorded_idx").on(t.puuid, t.recordedAt),
    // One snapshot per (player, match): makes MMR imports idempotent.
    uniqueIndex("mmr_snapshots_puuid_match_uq").on(t.puuid, t.matchId),
  ],
);

export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** URL-safe random code, generated in app code when the group is created. */
  inviteCode: text("invite_code").notNull().unique(),
  /** Ciphertext (encrypted at rest with WEBHOOK_ENCRYPTION_KEY), never the plain URL. */
  discordWebhookUrl: text("discord_webhook_url"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
});

export const groupMembers = pgTable(
  "group_members",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: groupRole("role").notNull().default("member"),
    joinedAt: timestamptz("joined_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.userId] })],
);

export type User = typeof users.$inferSelect;
export type RiotAccount = typeof riotAccounts.$inferSelect;
export type NewMatch = typeof matches.$inferInsert;
export type NewMatchPlayer = typeof matchPlayers.$inferInsert;
export type NewMmrSnapshot = typeof mmrSnapshots.$inferInsert;
