ALTER TABLE "trading_accounts" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
UPDATE "trading_accounts" SET "status" = 'active' WHERE "status" = 'funded';--> statement-breakpoint
DROP TYPE "public"."trading_account_status";--> statement-breakpoint
CREATE TYPE "public"."trading_account_status" AS ENUM('active', 'passed', 'failed');--> statement-breakpoint
ALTER TABLE "trading_accounts" ALTER COLUMN "status" SET DATA TYPE "public"."trading_account_status" USING "status"::"public"."trading_account_status";--> statement-breakpoint
ALTER TABLE "trading_accounts" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "trading_accounts" ADD CONSTRAINT "trading_accounts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;