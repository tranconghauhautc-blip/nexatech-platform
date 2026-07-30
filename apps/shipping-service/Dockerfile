# syntax=docker/dockerfile:1.7
# Production image for shipping-service (Nx NestJS webpack bundle + prod node_modules)
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable \
  && apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml nx.json tsconfig.base.json ./
COPY eslint.config.mjs ./
COPY libs ./libs
COPY apps ./apps
RUN pnpm install --frozen-lockfile
ENV NX_SKIP_NATIVE_FILE_CACHE=true
ENV NX_DAEMON=false
ENV NODE_ENV=production
RUN cd apps/shipping-service && pnpm exec prisma generate
RUN pnpm exec nx build shipping-service --configuration=production
# Materialize production deps from Nx-generated package.json + pruned lockfile.
# --ignore-workspace avoids the monorepo root workspace; store stays warm from the prior install.
RUN cd dist/apps/shipping-service \
  && pnpm install --prod --frozen-lockfile --ignore-workspace

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ARG NEXATECH_SECURITY_LAB=0
ARG NEXATECH_DEPLOY_PROFILE=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates curl \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd -g 10001 nexatech && useradd -u 10001 -g nexatech -m nexatech
ENV NODE_ENV=production
ENV PORT=3009
ENV NEXATECH_SECURITY_LAB=${NEXATECH_SECURITY_LAB}
ENV NEXATECH_DEPLOY_PROFILE=${NEXATECH_DEPLOY_PROFILE}
COPY --from=build /app/dist/apps/shipping-service/ ./
COPY --from=build /app/apps/shipping-service/src/generated/prisma/schema.prisma ./schema.prisma
COPY --from=build /app/apps/shipping-service/src/generated/prisma/libquery_engine-debian-openssl-3.0.x.so.node ./libquery_engine-debian-openssl-3.0.x.so.node
RUN chown -R nexatech:nexatech /app
USER nexatech
EXPOSE 3009
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:3009/health/live" || exit 1
CMD ["node", "main.js"]
