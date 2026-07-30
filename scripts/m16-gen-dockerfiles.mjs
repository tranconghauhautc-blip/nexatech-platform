import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

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
# Production image for ${name} (Nx NestJS webpack bundle)
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable \\
  && apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \\
  && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml nx.json tsconfig.base.json ./
COPY libs ./libs
COPY apps ./apps
RUN pnpm install --frozen-lockfile
ENV NX_SKIP_NATIVE_FILE_CACHE=true
ENV NX_DAEMON=false
ENV NODE_ENV=production
RUN cd apps/${name} && pnpm exec prisma generate
RUN pnpm exec nx build ${name} --configuration=production

FROM node:22-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates curl \\
  && rm -rf /var/lib/apt/lists/* \\
  && groupadd -r nexatech && useradd -r -g nexatech nexatech
ENV NODE_ENV=production
ENV PORT=${port}
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
