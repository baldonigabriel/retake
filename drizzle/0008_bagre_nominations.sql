CREATE TABLE "award_nominations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"nominee_id" text NOT NULL,
	"nominator_id" text,
	"match_id" text NOT NULL,
	"comment" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "award_nominations_not_self" CHECK ("award_nominations"."nominator_id" is null or "award_nominations"."nominator_id" <> "award_nominations"."nominee_id"),
	CONSTRAINT "award_nominations_comment_length" CHECK (char_length("award_nominations"."comment") between 1 and 140)
);
--> statement-breakpoint
ALTER TABLE "award_nominations" ADD CONSTRAINT "award_nominations_round_id_award_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."award_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_nominations" ADD CONSTRAINT "award_nominations_nominee_id_users_id_fk" FOREIGN KEY ("nominee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_nominations" ADD CONSTRAINT "award_nominations_nominator_id_users_id_fk" FOREIGN KEY ("nominator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_nominations" ADD CONSTRAINT "award_nominations_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "award_nominations_round_nominee_uq" ON "award_nominations" USING btree ("round_id","nominee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "award_nominations_id_round_nominee_uq" ON "award_nominations" USING btree ("id","round_id","nominee_id");--> statement-breakpoint
ALTER TABLE "award_rounds" ADD CONSTRAINT "award_rounds_winner_nomination_id_award_nominations_id_fk" FOREIGN KEY ("winner_nomination_id") REFERENCES "public"."award_nominations"("id") ON DELETE set null ON UPDATE no action;