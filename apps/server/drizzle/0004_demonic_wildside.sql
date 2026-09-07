ALTER TABLE "payments" ADD COLUMN "broker_id" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "broker_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "trading_accounts" ADD COLUMN "broker_id" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "trading_accounts" ALTER COLUMN "broker_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "trading_accounts" ADD COLUMN "broker_login" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "trading_accounts" ALTER COLUMN "broker_login" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "trading_accounts" ADD COLUMN "broker_password" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "trading_accounts" ALTER COLUMN "broker_password" DROP DEFAULT;
