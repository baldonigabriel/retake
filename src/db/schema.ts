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
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
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
export const discordPostStatus = pgEnum("discord_post_status", ["queued", "sending", "sent", "failed"]);
export const summaryStatus = pgEnum("summary_status", ["generating", "ready", "sending", "sent", "failed", "skipped"]);
export const summaryProvider = pgEnum("summary_provider", ["gemini", "groq", "rules"]);
export const goalMetric = pgEnum("goal_metric", ["hs", "acs", "kd", "adr", "winrate", "matches"]);
/** Group awards (docs/SPEC.md §5). Only "bagre" today; new categories are new values. */
export const awardCategory = pgEnum("award_category", ["bagre"]);
export const awardCadence = pgEnum("award_cadence", ["weekly", "daily"]);
export const awardRoundStatus = pgEnum("award_round_status", ["open", "closed"]);
export const awardOutcome = pgEnum("award_outcome", ["winner", "tie", "no_votes", "empty", "disabled"]);

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

/** OAuth links (Discord or Google). Tokens are never returned by Better Auth's API. */
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
  (t) => [
    index("accounts_user_id_idx").on(t.userId),
    uniqueIndex("accounts_provider_account_uq").on(t.providerId, t.accountId),
  ],
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

/**
 * Case- and accent-insensitive form of a name, used by the public profile
 * search (SPEC §6.4). `retake_fold` is an IMMUTABLE SQL function created in
 * migration 0013 (lower + translate of the common Latin accents, no
 * extension needed); src/lib/profile/search.ts folds the query the same way.
 */
export const foldName = (column: AnyPgColumn) => sql`retake_fold(${column})`;

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
  /** When a user claimed this account in onboarding. */
  linkedAt: timestamptz("linked_at"),
  lastSyncedAt: timestamptz("last_synced_at"),
  lastMatchAt: timestamptz("last_match_at"),
  syncStatus: syncStatus("sync_status").notNull().default("pending"),
  syncError: text("sync_error"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
}, (t) => [
  // Public profile search and /u/[riotId] lookups by the current Riot ID.
  index("riot_accounts_name_fold_idx").using("btree", sql`retake_fold(${t.gameName}) text_pattern_ops`),
]);

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
    /** Null on matches saved before Phase 9 or when the API omitted rounds. */
    roundsSyncedAt: timestamptz("rounds_synced_at"),
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

/** Raw round result. Derived metrics live in src/lib/rounds, never here. */
export const matchRounds = pgTable(
  "match_rounds",
  {
    matchId: text("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    round: integer("round").notNull(),
    winningTeam: text("winning_team"),
    result: text("result"),
    /** Team on attack for this round; null when the payload cannot establish it. */
    attackingTeam: text("attacking_team"),
  },
  (t) => [primaryKey({ columns: [t.matchId, t.round] })],
);

/** One player's raw, nullable round sample (SPEC §7). */
export const matchRoundPlayers = pgTable(
  "match_round_players",
  {
    matchId: text("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    round: integer("round").notNull(),
    puuid: text("puuid").notNull(),
    team: text("team").notNull(),
    weaponId: text("weapon_id"),
    weaponName: text("weapon_name"),
    armor: text("armor"),
    loadoutValue: integer("loadout_value"),
    /** The v4 round payload currently omits spent; keep it null rather than infer it. */
    spent: integer("spent"),
    damage: integer("damage"),
    /** Raw combat score for this round; needed for ACS by economy band. */
    score: integer("score"),
    headshots: integer("headshots"),
    bodyshots: integer("bodyshots"),
    legshots: integer("legshots"),
    kills: integer("kills"),
    assists: integer("assists"),
    survived: boolean("survived"),
  },
  (t) => [
    primaryKey({ columns: [t.matchId, t.round, t.puuid] }),
    index("match_round_players_puuid_match_idx").on(t.puuid, t.matchId),
  ],
);

/** Ordered raw kill feed for each round. */
export const matchKills = pgTable(
  "match_kills",
  {
    matchId: text("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    round: integer("round").notNull(),
    seq: integer("seq").notNull(),
    timeInRoundMs: integer("time_in_round_ms").notNull(),
    killerPuuid: text("killer_puuid"),
    victimPuuid: text("victim_puuid").notNull(),
    assistants: text("assistants").array().notNull(),
    weaponId: text("weapon_id"),
    weaponName: text("weapon_name"),
    weaponType: text("weapon_type"),
  },
  (t) => [
    primaryKey({ columns: [t.matchId, t.round, t.seq] }),
    index("match_kills_killer_puuid_idx").on(t.killerPuuid),
    index("match_kills_victim_puuid_idx").on(t.victimPuuid),
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
  /**
   * Invite token: 144 random bits, base64url (src/lib/groups/invite.ts).
   * Revoking the link replaces it, so the old link stops working at once.
   */
  inviteCode: text("invite_code").notNull().unique(),
  /** AES-256-GCM ciphertext (src/lib/crypto.ts, key ENCRYPTION_KEY), never the plain URL. */
  discordWebhookUrl: text("discord_webhook_url"),
  /** Bagre (SPEC §5.1): the owner can turn it off and pick weekly or daily periods. */
  bagreEnabled: boolean("bagre_enabled").notNull().default(true),
  bagreCadence: awardCadence("bagre_cadence").notNull().default("weekly"),
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
  (t) => [
    primaryKey({ columns: [t.groupId, t.userId] }),
    // "Which groups am I in?" runs on every group page.
    index("group_members_user_idx").on(t.userId),
  ],
);

/**
 * One Discord card per (group, match): the primary key is the idempotency
 * guard. Rows are queued by the sync, then claimed one at a time
 * (queued/failed → sending) by an atomic UPDATE, so two concurrent runs never
 * post the same card. A row stuck in "sending" (the function died mid-post)
 * is never retried: a missing card is better than a duplicate.
 */
export const discordPosts = pgTable(
  "discord_posts",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    matchId: text("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    status: discordPostStatus("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    /** Discord message id once posted (?wait=true). */
    messageId: text("message_id"),
    lastError: text("last_error"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    sentAt: timestamptz("sent_at"),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.matchId] }),
    index("discord_posts_status_created_idx").on(t.status, t.createdAt),
  ],
);

/**
 * Personal weekly goals (src/lib/goals). Only the target is stored: progress
 * is computed from match_players each time. One goal per metric per user;
 * the goal repeats every week until removed.
 */
export const goals = pgTable(
  "goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    metric: goalMetric("metric").notNull(),
    /** In the unit people type: HS% 25 = 25%, K/D 1.2 = 1,20. */
    target: doublePrecision("target").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("goals_user_metric_uq").on(t.userId, t.metric)],
);

/**
 * Per-user preferences. A missing row means every default (the app never
 * needs a row to exist); a row is created the first time a setting changes.
 */
export const userPreferences = pgTable("user_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  /** The gentle "take a break" note after losses in a row in the session (src/lib/stats/session.ts). */
  breakReminder: boolean("break_reminder").notNull().default(true),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
});

/**
 * One weekly summary per (group, week): the primary key is the "posted once"
 * guarantee, like discord_posts. A run claims the row by inserting it
 * ("generating"), writes the text and the provider that wrote it ("ready"),
 * then claims it again to post ("sending" → "sent"). A row stuck in
 * "sending" is never retried (a missing post beats a duplicate); one stuck
 * in "generating" posted nothing yet, so it's reclaimed after a while.
 */
export const weeklySummaries = pgTable(
  "weekly_summaries",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    /** Monday 00:00 São Paulo of the summarised week. */
    weekStart: timestamptz("week_start").notNull(),
    status: summaryStatus("status").notNull().default("generating"),
    /** Who wrote the text: gemini, groq or the rule-based fallback. */
    provider: summaryProvider("provider"),
    model: text("model"),
    text: text("text"),
    /** The aggregated numbers the text was written from (WeeklyStats). */
    stats: jsonb("stats"),
    attempts: integer("attempts").notNull().default(0),
    messageId: text("message_id"),
    lastError: text("last_error"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
    sentAt: timestamptz("sent_at"),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.weekStart] })],
);

/**
 * One voting period of a group award (SPEC §5). Opened lazily when a member
 * opens the screen; the unique (group, category, starts_at) makes two
 * concurrent opens create one row. Closed once by the cron with an
 * UPDATE … WHERE status = 'open'; the result (tally, winner, badge) is frozen
 * here. The Discord announcement follows the discord_posts pattern:
 * queued → sending → sent, and "sending" is never retried.
 */
export const awardRounds = pgTable(
  "award_rounds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    category: awardCategory("category").notNull().default("bagre"),
    /** The group's cadence when this period opened; later changes don't touch it. */
    cadence: awardCadence("cadence").notNull(),
    startsAt: timestamptz("starts_at").notNull(),
    /** Exclusive. */
    endsAt: timestamptz("ends_at").notNull(),
    status: awardRoundStatus("status").notNull().default("open"),
    outcome: awardOutcome("outcome"),
    winnerUserId: text("winner_user_id").references(() => users.id, { onDelete: "set null" }),
    winnerNominationId: uuid("winner_nomination_id").references((): AnyPgColumn => awardNominations.id, {
      onDelete: "set null",
    }),
    /** Frozen count at closing: [{ nominationId, nomineeId, votes, matches }]. */
    tally: jsonb("tally"),
    votesCast: integer("votes_cast"),
    /** The badge shows until this instant (end of the next period). */
    badgeUntil: timestamptz("badge_until"),
    closedAt: timestamptz("closed_at"),
    /** Null when there's nothing to post (no webhook, no result). */
    announceStatus: discordPostStatus("announce_status"),
    announceAttempts: integer("announce_attempts").notNull().default(0),
    messageId: text("message_id"),
    lastError: text("last_error"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    sentAt: timestamptz("sent_at"),
  },
  (t) => [
    uniqueIndex("award_rounds_group_category_start_uq").on(t.groupId, t.category, t.startsAt),
    index("award_rounds_status_ends_idx").on(t.status, t.endsAt),
  ],
);

/**
 * Opt-in public profile (SPEC §6). No row = private and never asked.
 * `decidedAt` is set the first time the user answers (onboarding, the /me
 * card or Ajustes). The show_* flags only matter while `isPublic`; a public
 * profile with nothing to show is treated as private (src/lib/profile).
 * `showWeapons` waits for Phase 9 (round and weapon stats).
 */
export const profileSettings = pgTable(
  "profile_settings",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    isPublic: boolean("is_public").notNull().default(false),
    showRank: boolean("show_rank").notNull().default(true),
    showOverview: boolean("show_overview").notNull().default(true),
    showAgents: boolean("show_agents").notNull().default(true),
    showMaps: boolean("show_maps").notNull().default(true),
    showMatches: boolean("show_matches").notNull().default(true),
    showWeapons: boolean("show_weapons").notNull().default(true),
    decidedAt: timestamptz("decided_at"),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  // Search only ever scans public profiles.
  (t) => [index("profile_settings_public_idx").on(t.userId).where(sql`${t.isPublic}`)],
);

/**
 * A member nominated in a period, tied to one match of theirs in it (SPEC
 * §5.3). One nomination per nominee per period (unique), never yourself
 * (CHECK). A future award_clips table hangs off `id` (SPEC §9).
 */
export const awardNominations = pgTable(
  "award_nominations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roundId: uuid("round_id")
      .notNull()
      .references(() => awardRounds.id, { onDelete: "cascade" }),
    nomineeId: text("nominee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Null once the nominator deletes their account; the nomination stays. */
    nominatorId: text("nominator_id").references(() => users.id, { onDelete: "set null" }),
    matchId: text("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    comment: text("comment").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("award_nominations_round_nominee_uq").on(t.roundId, t.nomineeId),
    // Target of award_votes' composite FK: a vote can't point at another round or lie about the nominee.
    uniqueIndex("award_nominations_id_round_nominee_uq").on(t.id, t.roundId, t.nomineeId),
    check("award_nominations_not_self", sql`${t.nominatorId} is null or ${t.nominatorId} <> ${t.nomineeId}`),
    check("award_nominations_comment_length", sql`char_length(${t.comment}) between 1 and 140`),
  ],
);

/**
 * One vote per member per period (PK), changeable until the end (upsert).
 * The composite FK pins the vote to a nomination of the SAME round with the
 * SAME nominee, so the CHECK below really means "never vote for yourself".
 * Withdrawing a nomination deletes its votes (cascade).
 */
export const awardVotes = pgTable(
  "award_votes",
  {
    roundId: uuid("round_id")
      .notNull()
      .references(() => awardRounds.id, { onDelete: "cascade" }),
    voterId: text("voter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    nominationId: uuid("nomination_id").notNull(),
    nomineeId: text("nominee_id").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.roundId, t.voterId] }),
    foreignKey({
      name: "award_votes_nomination_fk",
      columns: [t.nominationId, t.roundId, t.nomineeId],
      foreignColumns: [awardNominations.id, awardNominations.roundId, awardNominations.nomineeId],
    }).onDelete("cascade"),
    index("award_votes_nomination_idx").on(t.nominationId),
    check("award_votes_not_self", sql`${t.voterId} <> ${t.nomineeId}`),
  ],
);

export type User = typeof users.$inferSelect;
export type RiotAccount = typeof riotAccounts.$inferSelect;
export type NewMatch = typeof matches.$inferInsert;
export type NewMatchPlayer = typeof matchPlayers.$inferInsert;
export type NewMatchRound = typeof matchRounds.$inferInsert;
export type NewMatchRoundPlayer = typeof matchRoundPlayers.$inferInsert;
export type NewMatchKill = typeof matchKills.$inferInsert;
export type Group = typeof groups.$inferSelect;
export type GroupRole = (typeof groupRole.enumValues)[number];
export type DiscordPost = typeof discordPosts.$inferSelect;
export type NewMmrSnapshot = typeof mmrSnapshots.$inferInsert;
export type Goal = typeof goals.$inferSelect;
export type UserPreferences = typeof userPreferences.$inferSelect;
export type ProfileSettingsRow = typeof profileSettings.$inferSelect;
export type WeeklySummary = typeof weeklySummaries.$inferSelect;
export type AwardRound = typeof awardRounds.$inferSelect;
export type AwardNomination = typeof awardNominations.$inferSelect;
export type AwardVote = typeof awardVotes.$inferSelect;
