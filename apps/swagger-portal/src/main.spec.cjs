'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { createServer, isPortalAllowed, docsHtml } = require('./main.cjs');

describe('swagger-portal gate', () => {
  it('disallows production by default', () => {
    const prev = { ...process.env };
    process.env.NODE_ENV = 'production';
    delete process.env.NEXATECH_SWAGGER_PORTAL_ENABLED;
    delete process.env.NEXATECH_SECURITY_LAB;
    delete process.env.NEXATECH_DEPLOY_PROFILE;
    assert.equal(isPortalAllowed(), false);
    Object.assign(process.env, prev);
  });

  it('allows explicit enable flag', () => {
    const prev = { ...process.env };
    process.env.NODE_ENV = 'production';
    process.env.NEXATECH_SWAGGER_PORTAL_ENABLED = '1';
    assert.equal(isPortalAllowed(), true);
    Object.assign(process.env, prev);
  });
});

describe('swagger-portal http', () => {
  it('serves docs and openapi when enabled', async () => {
    const openApiDir = path.resolve(__dirname, '../../../openapi');
    const swaggerUiDist = path.resolve(
      __dirname,
      '../../../node_modules/swagger-ui-dist',
    );
    // Prefer portal package install path if root has no direct dep yet
    const fs = require('fs');
    const uiDist = fs.existsSync(path.join(swaggerUiDist, 'swagger-ui.css'))
      ? swaggerUiDist
      : path.resolve(__dirname, '../node_modules/swagger-ui-dist');

    const server = createServer({
      openApiDir,
      swaggerUiDist: fs.existsSync(path.join(uiDist, 'swagger-ui.css'))
        ? uiDist
        : null,
      allowed: true,
    });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();

    try {
      const health = await fetch(`http://127.0.0.1:${port}/health`);
      assert.equal(health.status, 200);
      const body = await health.json();
      assert.equal(body.service, 'swagger-portal');

      const docs = await fetch(`http://127.0.0.1:${port}/docs`);
      assert.equal(docs.status, 200);
      const html = await docs.text();
      assert.match(html, /nexatech-combined\.openapi\.yaml/);
      assert.match(docsHtml(), /Authorize|Download YAML/i);

      const yaml = await fetch(
        `http://127.0.0.1:${port}/openapi/nexatech-combined.openapi.yaml`,
      );
      assert.equal(yaml.status, 200);
      const text = await yaml.text();
      assert.match(text, /openapi:/);
      assert.match(text, /Identity|identity/i);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('returns 403 for docs when disabled', async () => {
    const server = createServer({
      openApiDir: path.resolve(__dirname, '../../../openapi'),
      swaggerUiDist: null,
      allowed: false,
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    try {
      const res = await fetch(`http://127.0.0.1:${port}/docs`);
      assert.equal(res.status, 403);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
