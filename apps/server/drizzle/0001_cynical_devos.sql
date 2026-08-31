ALTER TYPE "public"."account_status" RENAME TO "trading_account_status";--> statement-breakpoint
ALTER TABLE "fills" DROP CONSTRAINT "fills_account_id_accounts_id_fk";--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_account_id_accounts_id_fk";--> statement-breakpoint
ALTER TABLE "snapshots" DROP CONSTRAINT "snapshots_account_id_accounts_id_fk";--> statement-breakpoint
ALTER TABLE "accounts" RENAME TO "trading_accounts";--> statement-breakpoint
ALTER TABLE "fills" RENAME COLUMN "account_id" TO "trading_account_id";--> statement-breakpoint
ALTER TABLE "payments" RENAME COLUMN "account_id" TO "trading_account_id";--> statement-breakpoint
ALTER TABLE "snapshots" RENAME COLUMN "account_id" TO "trading_account_id";--> statement-breakpoint
ALTER TABLE "fills" ADD CONSTRAINT "fills_trading_account_id_trading_accounts_id_fk" FOREIGN KEY ("trading_account_id") REFERENCES "public"."trading_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_trading_account_id_trading_accounts_id_fk" FOREIGN KEY ("trading_account_id") REFERENCES "public"."trading_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_trading_account_id_trading_accounts_id_fk" FOREIGN KEY ("trading_account_id") REFERENCES "public"."trading_accounts"("id") ON DELETE no action ON UPDATE no action;
