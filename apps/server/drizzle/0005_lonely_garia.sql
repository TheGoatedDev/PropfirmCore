CREATE TYPE "public"."on_uncoverable" AS ENUM('failApprove', 'autoReject');--> statement-breakpoint
CREATE TYPE "public"."payout_mode" AS ENUM('debitOnApprove', 'freezeUntilApproved', 'debitOnPaid');--> statement-breakpoint
CREATE TYPE "public"."phase_kind" AS ENUM('eval', 'funded');--> statement-breakpoint
CREATE TABLE "brokers" (
	"firm_id" text NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"bridge_provider" text NOT NULL,
	"bridge_url" text,
	CONSTRAINT "brokers_firm_id_id_pk" PRIMARY KEY("firm_id","id")
);
--> statement-breakpoint
CREATE TABLE "firm" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"daily_close_tz" text NOT NULL,
	"daily_close_time" text NOT NULL,
	"modules_affiliates" boolean NOT NULL,
	"modules_kyc" boolean NOT NULL,
	"modules_multi_brand" boolean NOT NULL,
	"checkout_provider" text NOT NULL,
	"checkout_currency" text NOT NULL,
	"payout_on_uncoverable" "on_uncoverable" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phases" (
	"firm_id" text NOT NULL,
	"product_id" text NOT NULL,
	"idx" integer NOT NULL,
	"name" text NOT NULL,
	"kind" "phase_kind" NOT NULL,
	"balance" double precision NOT NULL,
	"fee" double precision,
	"profit_target" double precision NOT NULL,
	"max_drawdown" double precision NOT NULL,
	"daily_drawdown" double precision NOT NULL,
	"min_trading_days" integer NOT NULL,
	CONSTRAINT "phases_firm_id_product_id_idx_pk" PRIMARY KEY("firm_id","product_id","idx")
);
--> statement-breakpoint
CREATE TABLE "product_brokers" (
	"firm_id" text NOT NULL,
	"product_id" text NOT NULL,
	"broker_id" text NOT NULL,
	CONSTRAINT "product_brokers_firm_id_product_id_broker_id_pk" PRIMARY KEY("firm_id","product_id","broker_id")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"firm_id" text NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"payout_split" double precision,
	"payout_mode" "payout_mode",
	"payout_on_uncoverable" "on_uncoverable",
	CONSTRAINT "products_firm_id_id_pk" PRIMARY KEY("firm_id","id")
);
--> statement-breakpoint
INSERT INTO "firm" (
	"id",
	"name",
	"daily_close_tz",
	"daily_close_time",
	"modules_affiliates",
	"modules_kyc",
	"modules_multi_brand",
	"checkout_provider",
	"checkout_currency",
	"payout_on_uncoverable"
) VALUES (
	'acme',
	'Acme',
	'America/New_York',
	'17:00',
	false,
	false,
	false,
	'manual',
	'usd',
	'failApprove'
) ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "firm_id" text;--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "firm_id" text;--> statement-breakpoint
ALTER TABLE "trading_accounts" ADD COLUMN "firm_id" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "firm_id" text;--> statement-breakpoint
UPDATE "payments" SET "firm_id" = 'acme' WHERE "firm_id" IS NULL;--> statement-breakpoint
UPDATE "payouts" SET "firm_id" = 'acme' WHERE "firm_id" IS NULL;--> statement-breakpoint
UPDATE "trading_accounts" SET "firm_id" = 'acme' WHERE "firm_id" IS NULL;--> statement-breakpoint
UPDATE "user" SET "firm_id" = 'acme' WHERE "firm_id" IS NULL AND "role" IS DISTINCT FROM 'operator';--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "firm_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "payouts" ALTER COLUMN "firm_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "trading_accounts" ALTER COLUMN "firm_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "brokers" ADD CONSTRAINT "brokers_firm_id_firm_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firm"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_firm_id_firm_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firm"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_firm_id_firm_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firm"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_firm_id_firm_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firm"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_accounts" ADD CONSTRAINT "trading_accounts_firm_id_firm_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firm"("id") ON DELETE no action ON UPDATE no action;