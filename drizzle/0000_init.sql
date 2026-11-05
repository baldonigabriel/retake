CREATE TYPE "public"."group_role" AS ENUM('owner', 'member');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('ok', 'error', 'pending');--> statement-breakpoint
CREATE TABLE "group_members" (
	"group_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "group_role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_members_group_id_user_id_pk" PRIMARY KEY("group_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"owner_id" text NOT NULL,
	"invite_code" text NOT NULL,
	"discord_webhook_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "groups_slug_unique" UNIQUE("slug"),
	CONSTRAINT "groups_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "match_players" (
	"match_id" text NOT NULL,
	"puuid" text NOT NULL,
	"game_name" text NOT NULL,
	"tag_line" text NOT NULL,
	"team" text NOT NULL,
	"agent_id" text,
	"agent_name" text,
	"tier" integer,
	"kills" integer NOT NULL,
	"deaths" integer NOT NULL,
	"assists" integer NOT NULL,
	"score" integer NOT NULL,
	"damage_dealt" integer NOT NULL,
	"damage_received" integer NOT NULL,
	"headshots" integer NOT NULL,
	"bodyshots" integer NOT NULL,
	"legshots" integer NOT NULL,
	"won" boolean NOT NULL,
	CONSTRAINT "match_players_match_id_puuid_pk" PRIMARY KEY("match_id","puuid")
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" text PRIMARY KEY NOT NULL,
	"map_id" text,
	"map_name" text,
	"mode" text,
	"queue_id" text NOT NULL,
	"season_id" text,
	"started_at" timestamp with time zone NOT NULL,
	"game_length_ms" integer,
	"rounds_played" integer NOT NULL,
	"red_score" integer,
	"blue_score" integer,
	"winning_team" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mmr_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"puuid" text NOT NULL,
	"tier" integer NOT NULL,
	"tier_name" text NOT NULL,
	"rr" integer NOT NULL,
	"rr_change" integer,
	"elo" integer,
	"match_id" text,
	"recorded_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "riot_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"puuid" text NOT NULL,
	"game_name" text NOT NULL,
	"tag_line" text NOT NULL,
	"region" text DEFAULT 'br' NOT NULL,
	"platform" text DEFAULT 'pc' NOT NULL,
	"card_url" text,
	"last_synced_at" timestamp with time zone,
	"last_match_at" timestamp with time zone,
	"sync_status" "sync_status" DEFAULT 'pending' NOT NULL,
	"sync_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "riot_accounts_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "riot_accounts_puuid_unique" UNIQUE("puuid")
);
--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "match_players_puuid_match_idx" ON "match_players" USING btree ("puuid","match_id");--> statement-breakpoint
CREATE INDEX "matches_started_at_idx" ON "matches" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "mmr_snapshots_puuid_recorded_idx" ON "mmr_snapshots" USING btree ("puuid","recorded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "mmr_snapshots_puuid_match_uq" ON "mmr_snapshots" USING btree ("puuid","match_id");