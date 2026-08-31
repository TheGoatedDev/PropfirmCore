FROM node:24-alpine AS build
RUN corepack enable && corepack prepare pnpm@11.24.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages ./packages
COPY apps ./apps
ARG APP
ARG VITE_BASE=/
ENV VITE_BASE=$VITE_BASE
RUN pnpm install --frozen-lockfile
RUN pnpm --filter "@propfirmcore/${APP}" build

FROM nginx:1.27-alpine
ARG APP
ARG DIST_DEST=/usr/share/nginx/html
ARG NGINX_CONF=nginx.conf
COPY --from=build /app/apps/${APP}/dist ${DIST_DEST}
COPY infra/docker/${NGINX_CONF} /etc/nginx/conf.d/default.conf
