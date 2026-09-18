ALTER TABLE "brokers" DROP CONSTRAINT "brokers_firm_id_firm_id_fk";
--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_firm_id_firm_id_fk";
--> statement-breakpoint
ALTER TABLE "payouts" DROP CONSTRAINT "payouts_firm_id_firm_id_fk";
--> statement-breakpoint
ALTER TABLE "products" DROP CONSTRAINT "products_firm_id_firm_id_fk";
--> statement-breakpoint
ALTER TABLE "trading_accounts" DROP CONSTRAINT "trading_accounts_firm_id_firm_id_fk";
--> statement-breakpoint
ALTER TABLE "brokers" DROP CONSTRAINT "brokers_firm_id_id_pk";--> statement-breakpoint
ALTER TABLE "phases" DROP CONSTRAINT "phases_firm_id_product_id_idx_pk";--> statement-breakpoint
ALTER TABLE "product_brokers" DROP CONSTRAINT "product_brokers_firm_id_product_id_broker_id_pk";--> statement-breakpoint
ALTER TABLE "products" DROP CONSTRAINT "products_firm_id_id_pk";--> statement-breakpoint
ALTER TABLE "brokers" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "products" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "phases" ADD CONSTRAINT "phases_product_id_idx_pk" PRIMARY KEY("product_id","idx");--> statement-breakpoint
ALTER TABLE "product_brokers" ADD CONSTRAINT "product_brokers_product_id_broker_id_pk" PRIMARY KEY("product_id","broker_id");--> statement-breakpoint
ALTER TABLE "brokers" DROP COLUMN "firm_id";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "firm_id";--> statement-breakpoint
ALTER TABLE "payouts" DROP COLUMN "firm_id";--> statement-breakpoint
ALTER TABLE "phases" DROP COLUMN "firm_id";--> statement-breakpoint
ALTER TABLE "product_brokers" DROP COLUMN "firm_id";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "firm_id";--> statement-breakpoint
ALTER TABLE "trading_accounts" DROP COLUMN "firm_id";--> statement-breakpoint
UPDATE "user" SET "role" = 'admin' WHERE "role" = 'operator';