import { z } from "zod";

export const catalog = {
    user: ["list", "create", "ban", "set-role"],
    role: ["write"],
    payment: ["complete", "read", "list"],
    tradingAccount: ["read", "list", "fail", "pass", "resync", "reactivate"],
    payout: ["read", "list", "approve", "reject", "pay"],
    firm: ["read", "write"],
    broker: ["credentials"],
    kyc: ["write"],
} as const;

export type Resource = keyof typeof catalog;

export type Action<R extends Resource> = (typeof catalog)[R][number];

export type Permissions = { readonly [R in Resource]?: readonly Action<R>[] };

export const resources = Object.keys(catalog) as Resource[];

type PermissionsShape = {
    [R in Resource]: z.ZodOptional<
        z.ZodArray<z.ZodEnum<{ [A in Action<R>]: A }>>
    >;
};

export const permissionsSchema = z.strictObject(
    Object.fromEntries(
        resources.map((r) => [r, z.array(z.enum(catalog[r])).optional()]),
    ) as unknown as PermissionsShape,
);

export const builtinRoles = {
    trader: {},
    admin: catalog,
} as const satisfies Record<string, Permissions>;

export type BuiltinRole = keyof typeof builtinRoles;

export function isBuiltinRole(name: string): name is BuiltinRole {
    return Object.hasOwn(builtinRoles, name);
}

export const roleNameSchema = z
    .string()
    .regex(/^[a-z][a-z0-9-]{1,31}$/, "lowercase letters, digits, dashes");

export function hasPermission(
    perms: Permissions,
    resource: string,
    action: string,
): boolean {
    const actions = perms[resource as Resource] as
        | readonly string[]
        | undefined;
    return actions?.includes(action) ?? false;
}

/** True when every Permission in `perms` is also in `holder`. */
export function within(perms: Permissions, holder: Permissions): boolean {
    return resources.every((r) =>
        (perms[r] ?? []).every((a) => hasPermission(holder, r, a)),
    );
}

export function isStaff(perms: Permissions): boolean {
    return resources.some((r) => (perms[r]?.length ?? 0) > 0);
}

export function permissionsOf(
    role: string,
    custom: ReadonlyMap<string, Permissions>,
): Permissions {
    if (isBuiltinRole(role)) return builtinRoles[role];
    return custom.get(role) ?? {};
}
