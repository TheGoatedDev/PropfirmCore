type Spec = {
    paths?: Record<string, unknown>;
    components?: {
        schemas?: Record<string, unknown>;
        securitySchemes?: Record<string, unknown>;
    };
    tags?: unknown[];
};

export const openApiInfo = {
    openapi: "3.0.0",
    info: { title: "PropfirmCore", version: "0.0.0" },
};

export async function withAuthOpenAPI(
    spec: Spec,
    auth: { api: { generateOpenAPISchema?: () => Promise<Spec> } },
): Promise<Spec> {
    const generate = auth.api.generateOpenAPISchema;
    if (!generate) return spec;
    const authSpec = await generate();
    const paths = { ...spec.paths };
    for (const [path, item] of Object.entries(authSpec.paths ?? {})) {
        const prefixed = path.startsWith("/auth") ? path : `/auth${path}`;
        paths[prefixed] = item;
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
        tags: [...(spec.tags ?? []), ...(authSpec.tags ?? [])],
    };
}
