# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable \
  && apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml nx.json tsconfig.base.json ./
COPY eslint.config.mjs ./
COPY libs ./libs
COPY apps/backend-api ./apps/backend-api
RUN pnpm install --frozen-lockfile
ENV NX_SKIP_NATIVE_FILE_CACHE=true
ENV NX_DAEMON=false
ENV NODE_ENV=production
RUN cd apps/backend-api && pnpm exec prisma generate
RUN pnpm exec nx build backend-api --configuration=production
RUN cd dist/apps/backend-api \
  && pnpm install --prod --frozen-lockfile --ignore-workspace

FROM node:22-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates curl \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd -g 10001 vulncart && useradd -u 10001 -g vulncart -m vulncart
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /app/dist/apps/backend-api/ ./
COPY --from=build /app/apps/backend-api/src/generated/prisma/schema.prisma ./schema.prisma
COPY --from=build /app/apps/backend-api/src/generated/prisma/libquery_engine-debian-openssl-3.0.x.so.node ./libquery_engine-debian-openssl-3.0.x.so.node
COPY --from=build /app/apps/backend-api/prisma ./prisma
COPY --from=build /app/node_modules/prisma ./node_modules/prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
RUN chown -R vulncart:vulncart /app
USER vulncart
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:3000/health/live" || exit 1
CMD ["node", "main.js"]
