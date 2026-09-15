CREATE TYPE "public"."kyc_gate" AS ENUM('payout', 'funded');--> statement-breakpoint
ALTER TABLE "firm" ADD COLUMN "modules_kyc_gate" "kyc_gate" DEFAULT 'payout' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "kyc_verified" boolean DEFAULT false NOT NULL;