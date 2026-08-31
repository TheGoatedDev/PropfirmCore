import { eq } from "drizzle-orm";
import type { Db } from "../db/db.ts";
import type { Auth } from "./auth.ts";
import { user } from "./auth-schema.ts";

export async function bootstrapAdmin(
    db: Db,
    auth: Auth,
    creds: { email: string; password: string; name?: string },
): Promise<void> {
    const existing = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.role, "admin"))
        .limit(1);
    if (existing[0]) return;
    const res = await auth.api.signUpEmail({
        body: {
            email: creds.email,
            password: creds.password,
            name: creds.name ?? "Admin",
        },
    });
    if (!res.user) throw new Error("bootstrap admin signup failed");
    await db
        .update(user)
        .set({ role: "admin" })
        .where(eq(user.id, res.user.id));
}
