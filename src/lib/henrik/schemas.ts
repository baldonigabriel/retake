/**
 * Zod schemas for the HenrikDev responses we use. Only the fields we read are
 * declared; `z.object` strips everything else, so new or unknown fields never
 * break the sync. String-typed "enums" (queue ids, team ids) stay plain
 * strings for the same reason.
 */
import { z } from "zod";

const isoDate = z.iso.datetime({ offset: true });

const idName = z.object({
  id: z.string(),
  name: z.string(),
});

/** Envelope shared by every endpoint: `{ status, data }`. */
export function envelope<T extends z.ZodType>(data: T) {
  return z.object({ status: z.number().optional(), data });
}

/** Error body: `{ status, errors: [{ message, code, details }] }`. */
export const errorBodySchema = z.object({
  errors: z
    .array(
      z.object({
        message: z.string().optional(),
        code: z.number().optional(),
        details: z.string().nullish(),
      }),
    )
    .optional(),
});

// --- Account (GET /valorant/v2/account/{name}/{tag}) ------------------------

export const accountSchema = z.object({
  puuid: z.string().min(1),
  /** Riot shard ("na" for Brazil). Not the URL affinity — see SPEC §1. */
  region: z.string().nullish(),
  account_level: z.number().nullish(),
  name: z.string(),
  tag: z.string(),
  /** Player card id; the image URL is built from media.valorant-api.com. */
  card: z.string().nullish(),
});
export type HenrikAccount = z.infer<typeof accountSchema>;

// --- Match v4 (history items and GET /valorant/v4/match) --------------------

export const matchPlayerSchema = z.object({
  puuid: z.string().min(1),
  name: z.string(),
  tag: z.string(),
  team_id: z.string(),
  agent: idName.nullish(),
  tier: z.object({ id: z.number(), name: z.string().nullish() }).nullish(),
  stats: z.object({
    score: z.number(),
    kills: z.number(),
    deaths: z.number(),
    assists: z.number(),
    headshots: z.number(),
    bodyshots: z.number(),
    legshots: z.number(),
    damage: z.object({
      dealt: z.number(),
      received: z.number(),
    }),
  }),
});
export type HenrikMatchPlayer = z.infer<typeof matchPlayerSchema>;

export const matchTeamSchema = z.object({
  team_id: z.string(),
  rounds: z.object({ won: z.number(), lost: z.number() }).nullish(),
  won: z.boolean().nullish(),
});
export type HenrikMatchTeam = z.infer<typeof matchTeamSchema>;

const roundPlayerSchema = z.object({
  puuid: z.string(),
  name: z.string().optional(),
  tag: z.string().optional(),
  team: z.string(),
});

const roundWeaponSchema = z.object({
  id: z.string().nullish(),
  name: z.string().nullish(),
  type: z.string().nullish(),
});

export const matchRoundSchema = z.object({
  id: z.number(),
  result: z.string().nullish(),
  winning_team: z.string().nullish(),
  /** Lets us derive the attacking team even in overtime without guessing halves. */
  winning_team_role: z.string().nullish(),
  stats: z
    .array(
      z.object({
        player: roundPlayerSchema,
        damage_events: z
          .array(
            z.object({
              damage: z.number().nullish(),
              headshots: z.number().nullish(),
              bodyshots: z.number().nullish(),
              legshots: z.number().nullish(),
            }),
          )
          .nullish(),
        stats: z
          .object({
            score: z.number().nullish(),
            kills: z.number().nullish(),
            headshots: z.number().nullish(),
            bodyshots: z.number().nullish(),
            legshots: z.number().nullish(),
          })
          .nullish(),
        economy: z
          .object({
            loadout_value: z.number().nullish(),
            remaining: z.number().nullish(),
            weapon: roundWeaponSchema.nullish(),
            armor: z.object({ id: z.string(), name: z.string().nullish() }).nullish(),
          })
          .nullish(),
      }),
    )
    .nullish(),
});
export type HenrikMatchRound = z.infer<typeof matchRoundSchema>;

export const matchKillSchema = z.object({
  round: z.number(),
  time_in_round_in_ms: z.number(),
  killer: roundPlayerSchema.nullish(),
  victim: roundPlayerSchema,
  assistants: z.array(roundPlayerSchema).nullish(),
  weapon: roundWeaponSchema.nullish(),
});
export type HenrikMatchKill = z.infer<typeof matchKillSchema>;

export const matchSchema = z.object({
  metadata: z.object({
    match_id: z.string().min(1),
    map: idName.nullish(),
    game_length_in_ms: z.number().nullish(),
    started_at: isoDate,
    is_completed: z.boolean().nullish(),
    queue: z
      .object({
        id: z.string().nullish(),
        name: z.string().nullish(),
        mode_type: z.string().nullish(),
      })
      .nullish(),
    season: z.object({ id: z.string().nullish() }).nullish(),
    platform: z.string().nullish(),
  }),
  players: z.array(matchPlayerSchema),
  teams: z.array(matchTeamSchema).nullish(),
  rounds: z.array(matchRoundSchema).nullish(),
  kills: z.array(matchKillSchema).nullish(),
});
export type HenrikMatch = z.infer<typeof matchSchema>;

/**
 * History is parsed item by item: one malformed match is skipped and
 * reported instead of failing the whole page.
 */
export const matchHistorySchema = envelope(z.array(z.unknown()));

// --- MMR history v2 (GET /valorant/v2/by-puuid/mmr-history) -----------------
// Each entry is one competitive match: `match_id` plus `last_change`, the RR
// won or lost in it (docs.henrikdev.xyz, checked 2026-11-06). Only the last
// ~20 matches; older ones come from the stored history below.

/** Stored history documents `date` only as a string: accept any parseable date. */
const anyDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "invalid date");

export const mmrHistoryEntrySchema = z.object({
  match_id: z.string().nullish(),
  tier: z.object({ id: z.number(), name: z.string() }),
  rr: z.number(),
  last_change: z.number().nullish(),
  elo: z.number().nullish(),
  date: anyDate,
  queue_id: z.string().nullish(),
});
export type HenrikMmrEntry = z.infer<typeof mmrHistoryEntrySchema>;

export const mmrHistorySchema = z.object({
  history: z.array(z.unknown()),
});

// --- Stored MMR history v2 (GET /valorant/v2/by-puuid/stored-mmr-history) ---
// Same entry shape, read from HenrikDev's own database: it goes further back
// than the live history, so it's what the RR backfill uses. `?size=N`.

export const storedMmrHistorySchema = envelope(z.array(z.unknown()));
