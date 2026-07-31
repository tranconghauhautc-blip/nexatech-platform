'use strict';

/**
 * NexaTech Combined Swagger Portal — local / security-lab only.
 *
 * Serves Swagger UI for openapi/nexatech-combined.openapi.yaml.
 * Production: disabled unless NEXATECH_SWAGGER_PORTAL_ENABLED=1 (do not set in prod).
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT || process.env.SWAGGER_PORTAL_PORT || 8090);
const HOST = process.env.HOST || '0.0.0.0';

function resolveOpenApiDir() {
  const candidates = [
    process.env.OPENAPI_DIR,
    path.resolve(__dirname, '../../../openapi'),
    path.resolve(process.cwd(), 'openapi'),
    path.resolve('/openapi'),
  ].filter(Boolean);
  for (const dir of candidates) {
    const yaml = path.join(dir, 'nexatech-combined.openapi.yaml');
    if (fs.existsSync(yaml)) return dir;
  }
  return candidates[0];
}

function resolveSwaggerUiDist() {
  const candidates = [
    process.env.SWAGGER_UI_DIST,
    path.resolve(__dirname, '../../../node_modules/swagger-ui-dist'),
    path.resolve(process.cwd(), 'node_modules/swagger-ui-dist'),
    '/app/node_modules/swagger-ui-dist',
  ].filter(Boolean);
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'swagger-ui.css'))) return dir;
  }
  return null;
}

function isPortalAllowed() {
  if (process.env.NEXATECH_SWAGGER_PORTAL_ENABLED === '0') return false;
  if (process.env.NEXATECH_SWAGGER_PORTAL_ENABLED === '1') return true;
  if (process.env.NEXATECH_SECURITY_LAB === '1') return true;
  if (process.env.NEXATECH_DEPLOY_PROFILE === 'security-lab') return true;
  const nodeEnv = process.env.NODE_ENV || 'development';
  if (nodeEnv === 'development' || nodeEnv === 'test') return true;
  return false;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.yaml': 'application/yaml; charset=utf-8',
  '.yml': 'application/yaml; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function send(res, status, body, contentType, extraHeaders = {}) {
  res.writeHead(status, {
    'content-type': contentType,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...extraHeaders,
  });
  res.end(body);
}

function sendJson(res, status, payload) {
  send(res, status, `${JSON.stringify(payload)}\n`, 'application/json; charset=utf-8');
}

function docsHtml() {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>NexaTech Combined API — Swagger</title>
  <link rel="stylesheet" href="/docs/swagger-ui.css" />
  <style>
    body { margin: 0; background: #fafafa; }
    .nx-banner {
      font-family: ui-sans-serif, system-ui, sans-serif;
      background: #0f172a; color: #e2e8f0; padding: 12px 20px;
      display: flex; flex-wrap: wrap; gap: 12px 20px; align-items: center;
      justify-content: space-between;
    }
    .nx-banner a { color: #7dd3fc; }
    .nx-banner .links { display: flex; flex-wrap: wrap; gap: 14px; }
    .nx-note { opacity: 0.85; font-size: 13px; }
  </style>
</head>
<body>
  <header class="nx-banner">
    <div>
      <strong>NexaTech Combined Swagger</strong>
      <div class="nx-note">Local / security-lab only · Try it out via Kong <code>http://localhost:8000</code></div>
    </div>
    <div class="links">
      <a href="/openapi/nexatech-combined.openapi.yaml" download>Download YAML</a>
      <a href="/openapi/nexatech-combined.openapi.json" download>Download JSON</a>
      <a href="/health">Health</a>
      <a href="http://localhost:3001/docs" target="_blank" rel="noreferrer">Identity /docs</a>
    </div>
  </header>
  <div id="swagger-ui"></div>
  <script src="/docs/swagger-ui-bundle.js"></script>
  <script src="/docs/swagger-ui-standalone-preset.js"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: '/openapi/nexatech-combined.openapi.yaml',
      dom_id: '#swagger-ui',
      deepLinking: true,
      persistAuthorization: true,
      displayRequestDuration: true,
      tryItOutEnabled: true,
      filter: true,
      docExpansion: 'list',
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
      layout: 'StandaloneLayout',
      validatorUrl: null
    });
  </script>
</body>
</html>`;
}

function disabledHtml() {
  return `<!DOCTYPE html>
<html lang="vi"><head><meta charset="utf-8"/><title>Swagger portal disabled</title></head>
<body style="font-family:sans-serif;padding:2rem">
  <h1>Combined Swagger portal is disabled</h1>
  <p>This portal is for local/dev and security-lab only. Production must keep it off.</p>
  <p>Enable with <code>NEXATECH_SWAGGER_PORTAL_ENABLED=1</code> or lab profile.</p>
</body></html>`;
}

function safeJoin(rootDir, requestPath) {
  const cleaned = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, '');
  const full = path.resolve(rootDir, cleaned);
  if (!full.startsWith(path.resolve(rootDir))) return null;
  return full;
}

function createServer({ openApiDir, swaggerUiDist, allowed }) {
  return http.createServer((req, res) => {
    const method = req.method || 'GET';
    if (method !== 'GET' && method !== 'HEAD') {
      sendJson(res, 405, { errorCode: 'METHOD_NOT_ALLOWED', message: 'Only GET/HEAD' });
      return;
    }

    let pathname;
    try {
      pathname = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
        .pathname;
    } catch {
      sendJson(res, 400, { errorCode: 'BAD_REQUEST', message: 'Invalid URL' });
      return;
    }

    if (pathname === '/health' || pathname === '/health/live' || pathname === '/health/ready') {
      sendJson(res, 200, {
        status: 'ok',
        service: 'swagger-portal',
        portalEnabled: allowed,
        openapiDir: openApiDir,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!allowed) {
      if (pathname === '/' || pathname === '/docs' || pathname === '/docs/') {
        send(res, 403, disabledHtml(), 'text/html; charset=utf-8');
        return;
      }
      sendJson(res, 403, {
        errorCode: 'SWAGGER_PORTAL_DISABLED',
        message: 'Combined Swagger portal is disabled outside local/lab',
      });
      return;
    }

    if (pathname === '/' || pathname === '/docs' || pathname === '/docs/') {
      send(res, 200, docsHtml(), 'text/html; charset=utf-8');
      return;
    }

    if (pathname.startsWith('/docs/') && swaggerUiDist) {
      const asset = pathname.slice('/docs/'.length);
      const filePath = safeJoin(swaggerUiDist, asset);
      if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        sendJson(res, 404, { errorCode: 'NOT_FOUND', message: 'Asset not found' });
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      send(res, 200, fs.readFileSync(filePath), MIME[ext] || 'application/octet-stream');
      return;
    }

    if (pathname.startsWith('/openapi/')) {
      const asset = pathname.slice('/openapi/'.length);
      const filePath = safeJoin(openApiDir, asset);
      if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        sendJson(res, 404, { errorCode: 'NOT_FOUND', message: 'OpenAPI file not found' });
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      send(res, 200, fs.readFileSync(filePath), MIME[ext] || 'application/octet-stream', {
        'content-disposition': `inline; filename="${path.basename(filePath)}"`,
      });
      return;
    }

    sendJson(res, 404, { errorCode: 'NOT_FOUND', message: `No route for ${pathname}` });
  });
}

function main() {
  const allowed = isPortalAllowed();
  const openApiDir = resolveOpenApiDir();
  const swaggerUiDist = resolveSwaggerUiDist();

  if (allowed && !swaggerUiDist) {
    console.error('[swagger-portal] FATAL: swagger-ui-dist not found');
    process.exit(1);
  }
  if (allowed) {
    const yaml = path.join(openApiDir, 'nexatech-combined.openapi.yaml');
    if (!fs.existsSync(yaml)) {
      console.error(`[swagger-portal] FATAL: missing ${yaml}`);
      process.exit(1);
    }
  }

  const server = createServer({ openApiDir, swaggerUiDist, allowed });
  server.listen(PORT, HOST, () => {
    console.log(
      `[swagger-portal] listening http://${HOST}:${PORT}/docs enabled=${allowed}`,
    );
  });
}

if (require.main === module) {
  main();
}

module.exports = {
  isPortalAllowed,
  createServer,
  resolveOpenApiDir,
  docsHtml,
};
