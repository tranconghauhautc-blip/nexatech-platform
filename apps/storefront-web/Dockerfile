# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/storefront-web/project.json apps/storefront-web/
COPY libs ./libs
COPY nx.json tsconfig.base.json ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
ENV NX_SKIP_NATIVE_FILE_CACHE=true
ENV NX_DAEMON=false
ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER_BUILD=true
RUN pnpm exec nx build storefront-web --configuration=production

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
RUN groupadd -r nexatech && useradd -r -g nexatech nexatech
COPY --from=build /app/apps/storefront-web/.next/standalone ./
COPY --from=build /app/apps/storefront-web/.next/static ./apps/storefront-web/.next/static
COPY --from=build /app/apps/storefront-web/public ./apps/storefront-web/public
USER nexatech
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/storefront-web/server.js"]
