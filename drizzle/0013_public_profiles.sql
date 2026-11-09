CREATE TABLE "profile_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"show_rank" boolean DEFAULT true NOT NULL,
	"show_overview" boolean DEFAULT true NOT NULL,
	"show_agents" boolean DEFAULT true NOT NULL,
	"show_maps" boolean DEFAULT true NOT NULL,
	"show_matches" boolean DEFAULT true NOT NULL,
	"show_weapons" boolean DEFAULT true NOT NULL,
	"decided_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profile_settings" ADD CONSTRAINT "profile_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "profile_settings_public_idx" ON "profile_settings" USING btree ("user_id") WHERE "profile_settings"."is_public";--> statement-breakpoint
-- Accent- and case-insensitive name folding for the public profile search
-- (SPEC §6.4). Mirrored by foldName() in src/lib/profile/search.ts.
CREATE OR REPLACE FUNCTION retake_fold(value text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
AS $$
  SELECT translate(
    lower(value),
    'áàâãäåāéèêëēíìîïīóòôõöøōúùûüūçñýÿ',
    'aaaaaaaeeeeeiiiiiooooooouuuuucnyy'
  )
$$;
--> statement-breakpoint
CREATE INDEX "riot_accounts_name_fold_idx" ON "riot_accounts" USING btree (retake_fold("game_name") text_pattern_ops);