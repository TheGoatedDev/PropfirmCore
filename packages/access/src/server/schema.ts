import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { Permissions } from "../index.ts";

export const firmRoles = pgTable("firm_role", {
    name: text("name").primaryKey(),
    permissions: jsonb("permissions").$type<Permissions>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
        .defaultNow()
        .$onUpdate(() => new Date())
        .notNull(),
});
