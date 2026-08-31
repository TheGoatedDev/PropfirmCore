type Operation = { tags?: string[] };
type PathItem = Record<string, unknown>;

type Spec = {
    paths?: Record<string, PathItem>;
    components?: {
        schemas?: Record<string, unknown>;
        securitySchemes?: Record<string, unknown>;
    };
    tags?: { name: string; description?: string }[];
};

const httpMethods = new Set([
    "get",
    "put",
    "post",
    "delete",
    "options",
    "head",
    "patch",
    "trace",
]);

export const openApiInfo = {
    openapi: "3.0.0",
    info: { title: "PropfirmCore", version: "0.0.0" },
    servers: [{ url: "http://localhost:3000", description: "Local" }],
};

export const tags = {
    me: "Me",
    products: "Products",
    accounts: "Accounts",
    payments: "Payments",
} as const;

const tagMeta: Record<string, string> = {
    Authentication: "Sign-up, sign-in, session, password, and linked accounts.",
    "Authentication - Admin":
        "Better Auth admin plugin: users, roles, bans, impersonation.",
    [tags.me]: "The signed-in user.",
    [tags.products]: "Challenge products this firm sells, including checkout.",
    [tags.accounts]:
        "Trading accounts: session access, force pass or fail, and ingest.",
    [tags.payments]: "Checkout payments: status and admin complete.",
};

function authTag(path: string): string {
    return path.startsWith("/auth/admin")
        ? "Authentication - Admin"
        : "Authentication";
}

function retagAuthPath(item: PathItem, tag: string): PathItem {
    const next: PathItem = { ...item };
    for (const [key, value] of Object.entries(item)) {
        if (!httpMethods.has(key) || !value || typeof value !== "object") {
            continue;
        }
        next[key] = { ...(value as Operation), tags: [tag] };
    }
    return next;
}

function tagsUsed(paths: Record<string, PathItem>): string[] {
    const names = new Set<string>();
    for (const item of Object.values(paths)) {
        for (const [key, value] of Object.entries(item)) {
            if (!httpMethods.has(key) || !value || typeof value !== "object") {
                continue;
            }
            for (const tag of (value as Operation).tags ?? []) names.add(tag);
        }
    }
    return [...names];
}

export function describeTags(
    paths: Record<string, PathItem>,
): { name: string; description: string }[] {
    return tagsUsed(paths).map((name) => ({
        name,
        description: tagMeta[name] ?? `${name} endpoints.`,
    }));
}

export async function withAuthOpenAPI(
    spec: Spec,
    auth: { api: { generateOpenAPISchema?: (arg?: unknown) => Promise<Spec> } },
): Promise<Spec> {
    const generate = auth.api.generateOpenAPISchema;
    if (!generate) {
        return { ...spec, tags: describeTags(spec.paths ?? {}) };
    }
    const authSpec = await generate({});
    const paths = { ...spec.paths };
    for (const [path, item] of Object.entries(authSpec.paths ?? {})) {
        const prefixed = path.startsWith("/auth") ? path : `/auth${path}`;
        paths[prefixed] = retagAuthPath(item, authTag(prefixed));
    }
    return {
        ...spec,
        paths,
        components: {
            ...authSpec.components,
            ...spec.components,
            schemas: {
                ...authSpec.components?.schemas,
                ...spec.components?.schemas,
            },
            securitySchemes: {
                ...authSpec.components?.securitySchemes,
                ...spec.components?.securitySchemes,
            },
        },
        tags: describeTags(paths),
    };
}
