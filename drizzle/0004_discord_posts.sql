CREATE TYPE "public"."discord_post_status" AS ENUM('queued', 'sending', 'sent', 'failed');--> statement-breakpoint
CREATE TABLE "discord_posts" (
	"group_id" uuid NOT NULL,
	"match_id" text NOT NULL,
	"status" "discord_post_status" DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"message_id" text,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "discord_posts_group_id_match_id_pk" PRIMARY KEY("group_id","match_id")
);
--> statement-breakpoint
ALTER TABLE "discord_posts" ADD CONSTRAINT "discord_posts_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discord_posts" ADD CONSTRAINT "discord_posts_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "discord_posts_status_created_idx" ON "discord_posts" USING btree ("status","created_at");