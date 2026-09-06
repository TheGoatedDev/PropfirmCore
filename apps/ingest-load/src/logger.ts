import pino from "pino";

const level = process.env.LOG_LEVEL ?? "info";
const pretty = process.env.NODE_ENV !== "production" && level !== "silent";

export const log = pino(
    {
        level,
        ...(pretty
            ? {
                  transport: {
                      target: "pino-pretty",
                      options: { destination: 2 },
                  },
              }
            : {}),
    },
    pretty ? undefined : pino.destination(2),
);
