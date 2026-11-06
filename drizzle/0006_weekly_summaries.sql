CREATE TYPE "public"."summary_provider" AS ENUM('gemini', 'groq', 'rules');--> statement-breakpoint
CREATE TYPE "public"."summary_status" AS ENUM('generating', 'ready', 'sending', 'sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TABLE "weekly_summaries" (
	"group_id" uuid NOT NULL,
	"week_start" timestamp with time zone NOT NULL,
	"status" "summary_status" DEFAULT 'generating' NOT NULL,
	"provider" "summary_provider",
	"model" text,
	"text" text,
	"stats" jsonb,
	"attempts" integer DEFAULT 0 NOT NULL,
	"message_id" text,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "weekly_summaries_group_id_week_start_pk" PRIMARY KEY("group_id","week_start")
);
--> statement-breakpoint
ALTER TABLE "weekly_summaries" ADD CONSTRAINT "weekly_summaries_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;