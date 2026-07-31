# Combined Swagger portal — local/lab ONLY. Do not deploy to production clusters.
FROM docker.io/library/node:22-bookworm-slim@sha256:f32b81066cde10a75dbac96646099533316d94bac4150c55da1636e1f0ffdc46

WORKDIR /app

RUN groupadd -g 10001 nexatech && useradd -u 10001 -g nexatech -m nexatech

# Minimal runtime: portal server + swagger-ui-dist (exact versions pinned via package.json)
COPY apps/swagger-portal/package.json ./
RUN npm install --omit=dev --ignore-scripts \
  && npm cache clean --force

COPY apps/swagger-portal/src ./src
COPY openapi ./openapi

ENV NODE_ENV=production \
    PORT=8090 \
    HOST=0.0.0.0 \
    OPENAPI_DIR=/app/openapi \
    SWAGGER_UI_DIST=/app/node_modules/swagger-ui-dist \
    NEXATECH_SWAGGER_PORTAL_ENABLED=1

USER nexatech
EXPOSE 8090

HEALTHCHECK --interval=10s --timeout=5s --retries=5 --start-period=5s \
  CMD node -e "fetch('http://127.0.0.1:8090/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/main.cjs"]
