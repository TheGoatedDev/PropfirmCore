import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

export const statement = {
    ...defaultStatements,
    payment: ["complete", "read"],
} as const;

export const ac = createAccessControl(statement);

export const trader = ac.newRole({});

export const admin = ac.newRole({
    ...adminAc.statements,
    payment: ["complete", "read"],
});

export const roles = { trader, admin };

export const roleStatements: Record<
    string,
    Record<string, readonly string[]>
> = {
    trader: {},
    admin: {
        ...adminAc.statements,
        payment: ["complete", "read"],
    },
};

export function roleHasPermission(
    roleCsv: string,
    resource: string,
    action: string,
): boolean {
    for (const name of roleCsv.split(",").map((s) => s.trim())) {
        const actions = roleStatements[name]?.[resource];
        if (actions?.includes(action)) return true;
    }
    return false;
}
