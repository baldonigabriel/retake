CREATE TYPE "public"."award_cadence" AS ENUM('weekly', 'daily');--> statement-breakpoint
CREATE TYPE "public"."award_category" AS ENUM('bagre');--> statement-breakpoint
CREATE TYPE "public"."award_outcome" AS ENUM('winner', 'tie', 'no_votes', 'empty', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."award_round_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TABLE "award_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"category" "award_category" DEFAULT 'bagre' NOT NULL,
	"cadence" "award_cadence" NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "award_round_status" DEFAULT 'open' NOT NULL,
	"outcome" "award_outcome",
	"winner_user_id" text,
	"winner_nomination_id" uuid,
	"tally" jsonb,
	"votes_cast" integer,
	"badge_until" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"announce_status" "discord_post_status",
	"announce_attempts" integer DEFAULT 0 NOT NULL,
	"message_id" text,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "bagre_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "bagre_cadence" "award_cadence" DEFAULT 'weekly' NOT NULL;--> statement-breakpoint
ALTER TABLE "award_rounds" ADD CONSTRAINT "award_rounds_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_rounds" ADD CONSTRAINT "award_rounds_winner_user_id_users_id_fk" FOREIGN KEY ("winner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "award_rounds_group_category_start_uq" ON "award_rounds" USING btree ("group_id","category","starts_at");--> statement-breakpoint
CREATE INDEX "award_rounds_status_ends_idx" ON "award_rounds" USING btree ("status","ends_at");