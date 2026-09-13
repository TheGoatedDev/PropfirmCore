ALTER TABLE "products" ALTER COLUMN "payout_mode" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."payout_mode";--> statement-breakpoint
CREATE TYPE "public"."payout_mode" AS ENUM('debitOnApprove', 'freezeUntilApproved');--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "payout_mode" SET DATA TYPE "public"."payout_mode" USING "payout_mode"::"public"."payout_mode";