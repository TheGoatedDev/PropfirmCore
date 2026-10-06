ALTER TABLE "brokers" ADD COLUMN "ingest_key_hash" text;--> statement-breakpoint
ALTER TABLE "brokers" ADD COLUMN "bridge_key" text;--> statement-breakpoint
ALTER TABLE "brokers" ADD CONSTRAINT "brokers_ingest_key_hash_unique" UNIQUE("ingest_key_hash");