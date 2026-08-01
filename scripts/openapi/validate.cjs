#!/usr/bin/env node
'use strict';

/**
 * Validate generated OpenAPI artifacts:
 * - OpenAPI 3.x
 * - unique operationId
 * - paths present (when live-generated)
 * - protected-looking ops should declare security (warning)
 * - combined file exists and is valid
 */
const fs = require('fs');
const path = require('path');
const { SERVICES, OPENAPI_DIR_NAME } = require('./catalog.cjs');

const root = path.resolve(__dirname, '../..');
const openapiDir = path.join(root, OPENAPI_DIR_NAME);
const PUBLIC_PATH_HINTS =
  /\/(auth\/(login|register|forgot-password|reset-password|verify-email)|health|docs)/i;

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function collectOperations(doc) {
  const ops = [];
  for (const [p, methods] of Object.entries(doc.paths || {})) {
    for (const [method, op] of Object.entries(methods || {})) {
      if (method.startsWith('x-') || !op || typeof op !== 'object') continue;
      ops.push({ path: p, method, op });
    }
  }
  return ops;
}

function validateDoc(label, doc, { requirePaths }) {
  const errors = [];
  const warnings = [];

  if (!doc.openapi || String(doc.openapi) !== '3.0.3') {
    errors.push(`${label}: openapi must be exactly 3.0.3 (got ${doc.openapi})`);
  }
  if (!doc.info || !doc.info.title || !doc.info.version) {
    errors.push(`${label}: info.title and info.version required`);
  }
  if (!Array.isArray(doc.servers) || doc.servers.length < 1) {
    errors.push(`${label}: at least one server required`);
  }
  const schemes = (doc.components && doc.components.securitySchemes) || {};
  if (!schemes.bearer) {
    errors.push(`${label}: components.securitySchemes.bearer required`);
  }
  if (
    !doc.components ||
    !doc.components.schemas ||
    !doc.components.schemas.ErrorEnvelope
  ) {
    warnings.push(`${label}: ErrorEnvelope schema missing`);
  }

  const ops = collectOperations(doc);
  if (requirePaths && ops.length === 0) {
    errors.push(`${label}: no paths/operations (skeleton only?)`);
  }

  const seen = new Map();
  for (const { path: p, method, op } of ops) {
    const id = op.operationId;
    if (!id) {
      errors.push(
        `${label}: missing operationId for ${method.toUpperCase()} ${p}`,
      );
      continue;
    }
    if (seen.has(id)) {
      errors.push(
        `${label}: duplicate operationId "${id}" (${seen.get(id)} and ${method.toUpperCase()} ${p})`,
      );
    } else {
      seen.set(id, `${method.toUpperCase()} ${p}`);
    }

    const hasRequestBody = Boolean(op.requestBody);
    const hasResponses = op.responses && Object.keys(op.responses).length > 0;
    if (!hasResponses) {
      warnings.push(`${label}: ${id} missing responses`);
    }
    if (hasRequestBody) {
      const content =
        op.requestBody.content &&
        (op.requestBody.content['application/json'] ||
          Object.values(op.requestBody.content)[0]);
      if (!content || !content.schema) {
        warnings.push(`${label}: ${id} requestBody missing schema`);
      }
    }

    const looksProtected =
      !PUBLIC_PATH_HINTS.test(p) &&
      !['get'].includes(method) === false &&
      (p.includes('/admin') ||
        p.includes('/me') ||
        p.includes('/sessions') ||
        method !== 'get');
    const hasSecurity =
      (Array.isArray(op.security) && op.security.length > 0) ||
      (Array.isArray(doc.security) && doc.security.length > 0);
    if (
      looksProtected &&
      !hasSecurity &&
      (p.includes('/admin') || p.includes('/me') || method === 'delete')
    ) {
      warnings.push(
        `${label}: ${id} looks protected but has no security declaration`,
      );
    }
  }

  return { errors, warnings, opCount: ops.length };
}

function main() {
  let failed = false;
  const allWarnings = [];

  for (const service of SERVICES) {
    const jsonPath = path.join(openapiDir, `${service.id}.openapi.json`);
    const yamlPath = path.join(openapiDir, `${service.id}.openapi.yaml`);
    if (!fs.existsSync(jsonPath) || !fs.existsSync(yamlPath)) {
      console.error(`[openapi:validate] FAIL missing files for ${service.id}`);
      failed = true;
      continue;
    }
    const doc = loadJson(jsonPath);
    const requirePaths = process.env.OPENAPI_REQUIRE_PATHS === '1';
    const { errors, warnings, opCount } = validateDoc(service.id, doc, {
      requirePaths,
    });
    for (const w of warnings) allWarnings.push(w);
    if (errors.length) {
      failed = true;
      for (const e of errors) console.error(`[openapi:validate] ERROR ${e}`);
    } else {
      console.log(
        `[openapi:validate] OK ${service.id} operations=${opCount} warnings=${warnings.length}`,
      );
    }
  }

  const combinedPath = path.join(openapiDir, 'nexatech-combined.openapi.json');
  if (!fs.existsSync(combinedPath)) {
    console.error(
      '[openapi:validate] FAIL missing nexatech-combined.openapi.json — run pnpm openapi:combine',
    );
    failed = true;
  } else {
    const combined = loadJson(combinedPath);
    const { errors, warnings, opCount } = validateDoc('combined', combined, {
      requirePaths: process.env.OPENAPI_REQUIRE_PATHS === '1',
    });
    for (const w of warnings) allWarnings.push(w);
    if (errors.length) {
      failed = true;
      for (const e of errors) console.error(`[openapi:validate] ERROR ${e}`);
    } else {
      console.log(
        `[openapi:validate] OK combined operations=${opCount} warnings=${warnings.length}`,
      );
    }
    const kong = (combined.servers || []).some(
      (s) => s.url && String(s.url).includes('localhost:8000'),
    );
    if (!kong) {
      console.error('[openapi:validate] ERROR combined missing Kong server');
      failed = true;
    }
  }

  if (allWarnings.length && process.env.OPENAPI_STRICT_WARNINGS === '1') {
    failed = true;
    for (const w of allWarnings)
      console.error(`[openapi:validate] WARN→ERR ${w}`);
  } else {
    for (const w of allWarnings.slice(0, 40)) {
      console.warn(`[openapi:validate] WARN ${w}`);
    }
    if (allWarnings.length > 40) {
      console.warn(
        `[openapi:validate] WARN … ${allWarnings.length - 40} more warnings`,
      );
    }
  }

  if (failed) {
    console.error('[openapi:validate] FAILED');
    process.exit(1);
  }
  console.log('[openapi:validate] PASSED');
}

main();
