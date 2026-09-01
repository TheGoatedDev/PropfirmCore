CREATE TYPE "public"."payout_reason" AS ENUM('uncoverable', 'admin');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('pending', 'approved', 'rejected', 'paid');--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"trading_account_id" text NOT NULL,
	"amount" double precision NOT NULL,
	"currency" text NOT NULL,
	"status" "payout_status" NOT NULL,
	"reason" "payout_reason"
);
--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_trading_account_id_trading_accounts_id_fk" FOREIGN KEY ("trading_account_id") REFERENCES "public"."trading_accounts"("id") ON DELETE no action ON UPDATE no action;