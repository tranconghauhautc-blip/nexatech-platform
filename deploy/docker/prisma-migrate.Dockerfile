# syntax=docker/dockerfile:1.7
# Prisma migrate image for a single Nest service.
# Build:
#   docker build -f deploy/docker/prisma-migrate.Dockerfile \
#     --build-arg SERVICE_NAME=identity-service \
#     -t nexatech/identity-service:0.17.0-migrate .
ARG SERVICE_NAME=identity-service
FROM node:22-bookworm-slim AS migrate
ARG SERVICE_NAME
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd -g 10001 nexatech && useradd -u 10001 -g nexatech -m nexatech
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && npm install -g prisma@6.5.0
COPY apps/${SERVICE_NAME}/prisma ./prisma
COPY apps/${SERVICE_NAME}/prisma ./schema-dir
# Prisma needs schema at known path; also support DATABASE_URL / service-specific env via Job
RUN printf '%s\n' '#!/bin/sh' 'set -euo pipefail' \
  'echo "prisma migrate deploy (${SERVICE_NAME})"' \
  'exec prisma migrate deploy --schema=/app/prisma/schema.prisma' \
  > /app/migrate.sh && chmod +x /app/migrate.sh
USER nexatech
ENTRYPOINT ["/app/migrate.sh"]
