CREATE TYPE "public"."breach_severity" AS ENUM('warn', 'flag');--> statement-breakpoint
CREATE TABLE "rule_breaches" (
	"trading_account_id" text NOT NULL,
	"phase_index" integer NOT NULL,
	"rule_id" text NOT NULL,
	"severity" "breach_severity" NOT NULL,
	"subject_id" text NOT NULL,
	"position_id" text,
	"ts" text NOT NULL,
	CONSTRAINT "rule_breaches_trading_account_id_phase_index_rule_id_subject_id_pk" PRIMARY KEY("trading_account_id","phase_index","rule_id","subject_id")
);
--> statement-breakpoint
ALTER TABLE "phases" ADD COLUMN "max_warnings" integer;--> statement-breakpoint
ALTER TABLE "phases" ADD COLUMN "consistency" jsonb;--> statement-breakpoint
ALTER TABLE "phases" ADD COLUMN "weekend" jsonb;--> statement-breakpoint
ALTER TABLE "phases" ADD COLUMN "max_lot" jsonb;--> statement-breakpoint
ALTER TABLE "trading_accounts" ADD COLUMN "daily_pnls" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "trading_accounts" ADD COLUMN "ruleset" jsonb DEFAULT '{"profitTarget":0,"maxDrawdown":1,"dailyDrawdown":1,"minTradingDays":0}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "rule_breaches" ADD CONSTRAINT "rule_breaches_trading_account_id_trading_accounts_id_fk" FOREIGN KEY ("trading_account_id") REFERENCES "public"."trading_accounts"("id") ON DELETE no action ON UPDATE no action;