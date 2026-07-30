import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Generates production Dockerfiles for all Nest backend services.
 *
 * Runtime packaging contract:
 * - Nx webpack build uses generatePackageJson + pruned pnpm-lock.yaml
 * - Dependencies stay external (not blindly copying workspace node_modules)
 * - Build stage materializes production node_modules via:
 *     pnpm install --prod --frozen-lockfile --ignore-workspace
 * - Runner copies dist (main.js + package.json + lockfile + node_modules)
 *   plus Prisma schema/engine when present
 *
 * Root cause previously: runner copied the bundle only, so require('@nestjs/common')
 * failed. tslib must also be a root production dependency because tsconfig
 * importHelpers:true emits require('tslib') into main.js.
 */
const services = [
  ['identity-service', 3001],
  ['customer-service', 3002],
  ['catalog-service', 3003],
  ['media-service', 3004],
  ['inventory-service', 3005],
  ['cart-service', 3006],
  ['order-service', 3007],
  ['payment-service', 3008],
  ['shipping-service', 3009],
  ['review-service', 3010],
  ['warranty-service', 3011],
  ['support-service', 3012],
  ['notification-service', 3013],
  ['reporting-service', 3014],
];

function dockerfile(name, port) {
  return `# syntax=docker/dockerfile:1.7
# Production image for ${name} (Nx NestJS webpack bundle + prod node_modules)
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable \\
  && apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \\
  && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml nx.json tsconfig.base.json ./
COPY eslint.config.mjs ./
COPY libs ./libs
COPY apps ./apps
RUN pnpm install --frozen-lockfile
ENV NX_SKIP_NATIVE_FILE_CACHE=true
ENV NX_DAEMON=false
ENV NODE_ENV=production
RUN cd apps/${name} && pnpm exec prisma generate
RUN pnpm exec nx build ${name} --configuration=production
# Materialize production deps from Nx-generated package.json + pruned lockfile.
# --ignore-workspace avoids the monorepo root workspace; store stays warm from the prior install.
RUN cd dist/apps/${name} \\
  && pnpm install --prod --frozen-lockfile --ignore-workspace

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ARG NEXATECH_SECURITY_LAB=0
ARG NEXATECH_DEPLOY_PROFILE=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates curl \\
  && rm -rf /var/lib/apt/lists/* \\
  && groupadd -g 10001 nexatech && useradd -u 10001 -g nexatech -m nexatech
ENV NODE_ENV=production
ENV PORT=${port}
ENV NEXATECH_SECURITY_LAB=\${NEXATECH_SECURITY_LAB}
ENV NEXATECH_DEPLOY_PROFILE=\${NEXATECH_DEPLOY_PROFILE}
COPY --from=build /app/dist/apps/${name}/ ./
COPY --from=build /app/apps/${name}/src/generated/prisma/schema.prisma ./schema.prisma
COPY --from=build /app/apps/${name}/src/generated/prisma/libquery_engine-debian-openssl-3.0.x.so.node ./libquery_engine-debian-openssl-3.0.x.so.node
RUN chown -R nexatech:nexatech /app
USER nexatech
EXPOSE ${port}
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \\
  CMD curl -fsS "http://127.0.0.1:${port}/health/live" || exit 1
CMD ["node", "main.js"]
`;
}

const root = process.cwd();
for (const [name, port] of services) {
  const path = join(root, 'apps', name, 'Dockerfile');
  writeFileSync(path, dockerfile(name, port), 'utf8');
  console.log('wrote', path);
}
