CREATE TABLE "match_kills" (
	"match_id" text NOT NULL,
	"round" integer NOT NULL,
	"seq" integer NOT NULL,
	"time_in_round_ms" integer NOT NULL,
	"killer_puuid" text,
	"victim_puuid" text NOT NULL,
	"assistants" text[] NOT NULL,
	"weapon_id" text,
	"weapon_name" text,
	"weapon_type" text,
	CONSTRAINT "match_kills_match_id_round_seq_pk" PRIMARY KEY("match_id","round","seq")
);
--> statement-breakpoint
CREATE TABLE "match_round_players" (
	"match_id" text NOT NULL,
	"round" integer NOT NULL,
	"puuid" text NOT NULL,
	"team" text NOT NULL,
	"weapon_id" text,
	"weapon_name" text,
	"armor" text,
	"loadout_value" integer,
	"spent" integer,
	"damage" integer,
	"headshots" integer,
	"bodyshots" integer,
	"legshots" integer,
	"kills" integer,
	"assists" integer,
	"survived" boolean,
	CONSTRAINT "match_round_players_match_id_round_puuid_pk" PRIMARY KEY("match_id","round","puuid")
);
--> statement-breakpoint
CREATE TABLE "match_rounds" (
	"match_id" text NOT NULL,
	"round" integer NOT NULL,
	"winning_team" text,
	"result" text,
	"attacking_team" text,
	CONSTRAINT "match_rounds_match_id_round_pk" PRIMARY KEY("match_id","round")
);
--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "rounds_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "match_kills" ADD CONSTRAINT "match_kills_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_round_players" ADD CONSTRAINT "match_round_players_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_rounds" ADD CONSTRAINT "match_rounds_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "match_kills_killer_puuid_idx" ON "match_kills" USING btree ("killer_puuid");--> statement-breakpoint
CREATE INDEX "match_kills_victim_puuid_idx" ON "match_kills" USING btree ("victim_puuid");--> statement-breakpoint
CREATE INDEX "match_round_players_puuid_match_idx" ON "match_round_players" USING btree ("puuid","match_id");