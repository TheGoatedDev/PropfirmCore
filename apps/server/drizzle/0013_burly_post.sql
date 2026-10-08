-- Backfill before NOT NULL; admin plugin rows could hold null.
UPDATE "user" SET "role" = 'trader' WHERE "role" IS NULL;--> statement-breakpoint
UPDATE "user" SET "banned" = false WHERE "banned" IS NULL;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "role" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "banned" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "session" DROP COLUMN "impersonated_by";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "ban_reason";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "ban_expires";