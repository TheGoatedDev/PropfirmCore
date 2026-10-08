import { createStaffUser } from "@propfirmcore/access/server";
import { and, eq } from "drizzle-orm";
import type { Db } from "../db/db.ts";
import type { Auth } from "./auth.ts";
import { user } from "./auth-schema.ts";

/** Make sure one unbanned Admin exists. Doubles as lock-out recovery. */
export async function bootstrapAdmin(
    db: Db,
    auth: Auth,
    creds: { email: string; password: string; name?: string },
): Promise<void> {
    const live = await db
        .select({ id: user.id })
        .from(user)
        .where(and(eq(user.role, "admin"), eq(user.banned, false)))
        .limit(1);
    if (live[0]) return;
    const email = creds.email.toLowerCase();
    const found = await db
        .update(user)
        .set({ role: "admin", banned: false })
        .where(eq(user.email, email))
        .returning({ id: user.id });
    if (found[0]) return;
    const created = await createStaffUser(auth, {
        email,
        password: creds.password,
        name: creds.name ?? "Admin",
        role: "admin",
    });
    if (!created) throw new Error("bootstrap admin create failed");
}
