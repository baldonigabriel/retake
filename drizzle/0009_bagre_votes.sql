CREATE TABLE "award_votes" (
	"round_id" uuid NOT NULL,
	"voter_id" text NOT NULL,
	"nomination_id" uuid NOT NULL,
	"nominee_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "award_votes_round_id_voter_id_pk" PRIMARY KEY("round_id","voter_id"),
	CONSTRAINT "award_votes_not_self" CHECK ("award_votes"."voter_id" <> "award_votes"."nominee_id")
);
--> statement-breakpoint
ALTER TABLE "award_votes" ADD CONSTRAINT "award_votes_round_id_award_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."award_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_votes" ADD CONSTRAINT "award_votes_voter_id_users_id_fk" FOREIGN KEY ("voter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "award_votes" ADD CONSTRAINT "award_votes_nomination_fk" FOREIGN KEY ("nomination_id","round_id","nominee_id") REFERENCES "public"."award_nominations"("id","round_id","nominee_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "award_votes_nomination_idx" ON "award_votes" USING btree ("nomination_id");