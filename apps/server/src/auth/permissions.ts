import { catalog } from "@propfirmcore/access";
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

// Better Auth admin plugin wiring only. Our checks use @propfirmcore/access.
export const ac = createAccessControl({ ...defaultStatements, ...catalog });

export const trader = ac.newRole({});

export const admin = ac.newRole({ ...adminAc.statements, ...catalog });
