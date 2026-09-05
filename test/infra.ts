import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { GenericContainer } from "testcontainers";

export const testAppEnv = {
    NATS_TOKEN: "dev",
    INGEST_API_KEY: "dev",
    BETTER_AUTH_SECRET: "change-me-to-a-long-random-string",
    BETTER_AUTH_URL: "http://localhost:3000",
    BOOTSTRAP_ADMIN_EMAIL: "admin@example.com",
    BOOTSTRAP_ADMIN_PASSWORD: "changeme",
};

export type Infra = {
    databaseUrl: string;
    natsUrl: string;
    stop: () => Promise<void>;
};

export async function startInfra(): Promise<Infra> {
    const pg = await new PostgreSqlContainer("postgres:17-alpine")
        .withUsername("propfirm")
        .withPassword("propfirm")
        .withDatabase("propfirm")
        .start();
    const nats = await new GenericContainer("nats:2-alpine")
        .withCommand(["-js", "-auth", "dev"])
        .withExposedPorts(4222)
        .start();
    return {
        databaseUrl: pg.getConnectionUri(),
        natsUrl: `nats://${nats.getHost()}:${nats.getMappedPort(4222)}`,
        async stop() {
            await Promise.all([pg.stop(), nats.stop()]);
        },
    };
}
