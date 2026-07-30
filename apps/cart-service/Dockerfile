# syntax=docker/dockerfile:1.7
# Production image for cart-service (Nx NestJS webpack bundle)
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable \
  && apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml nx.json tsconfig.base.json ./
COPY libs ./libs
COPY apps ./apps
RUN pnpm install --frozen-lockfile
ENV NX_SKIP_NATIVE_FILE_CACHE=true
ENV NX_DAEMON=false
ENV NODE_ENV=production
RUN cd apps/cart-service && pnpm exec prisma generate
RUN pnpm exec nx build cart-service --configuration=production

FROM node:22-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates curl \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd -r nexatech && useradd -r -g nexatech nexatech
ENV NODE_ENV=production
ENV PORT=3006
COPY --from=build /app/dist/apps/cart-service/ ./
COPY --from=build /app/apps/cart-service/src/generated/prisma/schema.prisma ./schema.prisma
COPY --from=build /app/apps/cart-service/src/generated/prisma/libquery_engine-debian-openssl-3.0.x.so.node ./libquery_engine-debian-openssl-3.0.x.so.node
RUN chown -R nexatech:nexatech /app
USER nexatech
EXPOSE 3006
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:3006/health/live" || exit 1
CMD ["node", "main.js"]
