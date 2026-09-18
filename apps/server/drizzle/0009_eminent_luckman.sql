ALTER TABLE "firm" ALTER COLUMN "modules_kyc_gate" SET DEFAULT 'payout';--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "firm_id";