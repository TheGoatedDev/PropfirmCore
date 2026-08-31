FROM node:24-alpine
RUN corepack enable && corepack prepare pnpm@11.24.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages ./packages
COPY apps/server ./apps/server
COPY firm.example.json ./
RUN pnpm install --frozen-lockfile
WORKDIR /app/apps/server
ENV ROLE=api
CMD ["sh", "-c", "if [ \"$ROLE\" = worker ]; then exec pnpm exec tsx src/worker.ts; else exec pnpm exec tsx src/api.ts; fi"]
