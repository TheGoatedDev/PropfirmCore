import {
    APIError,
    type AuthContext,
    type BetterAuthPlugin,
    createLocalAccountIssuer,
} from "better-auth";

export const BANNED_USER = "BANNED_USER";

/**
 * Better Auth lifecycle for Roles and bans. No endpoints: Role and User
 * management are our own routes, checked with `roleHasPermission`.
 */
export function firmAccess() {
    return {
        id: "firm-access",
        schema: {
            user: {
                fields: {
                    role: {
                        type: "string",
                        required: false,
                        defaultValue: "trader",
                        input: false,
                    },
                    banned: {
                        type: "boolean",
                        required: false,
                        defaultValue: false,
                        input: false,
                    },
                },
            },
        },
        init() {
            return {
                options: {
                    databaseHooks: {
                        session: {
                            create: {
                                async before(session, ctx) {
                                    if (!ctx) return;
                                    const user =
                                        await ctx.context.internalAdapter.findUserById(
                                            session.userId,
                                        );
                                    if (
                                        (user as { banned?: boolean } | null)
                                            ?.banned
                                    ) {
                                        throw APIError.from("FORBIDDEN", {
                                            message: "This user is banned.",
                                            code: BANNED_USER,
                                        });
                                    }
                                },
                            },
                        },
                    },
                },
            };
        },
        $ERROR_CODES: {
            [BANNED_USER]: {
                code: BANNED_USER,
                message: "This user is banned.",
            },
        },
    } satisfies BetterAuthPlugin;
}

// Only what we call: the full AuthContext is generic over the auth options.
type HasContext = {
    $context: Promise<{
        internalAdapter: Pick<
            AuthContext["internalAdapter"],
            "findUserByEmail" | "createUser" | "linkAccount" | "deleteUser"
        >;
        password: Pick<AuthContext["password"], "hash">;
    }>;
};

/**
 * Create a User with a credential login and a Role. Skips sign-up hooks and
 * Better Auth's password length check: callers validate input first.
 * Returns null when the email is taken.
 */
export async function createStaffUser(
    auth: HasContext,
    input: { email: string; name: string; password: string; role: string },
): Promise<{ id: string } | null> {
    const ctx = await auth.$context;
    const email = input.email.toLowerCase();
    if (await ctx.internalAdapter.findUserByEmail(email)) return null;
    const password = await ctx.password.hash(input.password);
    let user: { id: string };
    try {
        user = await ctx.internalAdapter.createUser(
            { email, name: input.name, role: input.role },
            { method: "admin" },
        );
    } catch (err) {
        // Lost a race to a concurrent create: the unique email index fired.
        if (await ctx.internalAdapter.findUserByEmail(email)) return null;
        throw err;
    }
    try {
        await ctx.internalAdapter.linkAccount({
            providerId: "credential",
            issuer: createLocalAccountIssuer("credential"),
            accountId: user.id,
            userId: user.id,
            password,
        });
    } catch (err) {
        // No login without the credential row; don't leave the email stuck.
        await ctx.internalAdapter.deleteUser(user.id);
        throw err;
    }
    return { id: user.id };
}
