import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

export const statement = {
    ...defaultStatements,
    payment: ["complete", "read"],
    tradingAccount: ["read", "list", "fail", "pass", "resync"],
    payout: ["read", "list", "approve", "reject", "pay"],
    firm: ["read", "write"],
    kyc: ["write"],
} as const;

export const ac = createAccessControl(statement);

export const trader = ac.newRole({});

const staff = {
    ...adminAc.statements,
    payment: ["complete", "read"],
    tradingAccount: ["read", "list", "fail", "pass", "resync"],
    payout: ["read", "list", "approve", "reject", "pay"],
    firm: ["read", "write"],
    kyc: ["write"],
} as const;

export const admin = ac.newRole(staff);

export const operator = ac.newRole(staff);

export const roles = { trader, admin, operator };

export const roleStatements: Record<
    string,
    Record<string, readonly string[]>
> = {
    trader: {},
    admin: staff,
    operator: staff,
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
