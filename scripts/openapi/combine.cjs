#!/usr/bin/env node
'use strict';

/**
 * Combine per-service OpenAPI JSON into nexatech-combined.openapi.{json,yaml}.
 */
const fs = require('fs');
const path = require('path');
const { SERVICES, OPENAPI_DIR_NAME, KONG_URL } = require('./catalog.cjs');
const { dumpYaml, sortObjectDeep } = require('./yaml.cjs');

const root = path.resolve(__dirname, '../..');
const openapiDir = path.join(root, OPENAPI_DIR_NAME);

function loadServiceDoc(serviceId) {
  const jsonPath = path.join(openapiDir, `${serviceId}.openapi.json`);
  if (!fs.existsSync(jsonPath)) {
    throw new Error(
      `Missing ${path.relative(root, jsonPath)} — run pnpm openapi:generate first`,
    );
  }
  return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
}

const SERVICE_DISPLAY_TAGS = {
  'identity-service': 'Identity',
  'customer-service': 'Customer',
  'catalog-service': 'Catalog',
  'media-service': 'Media',
  'inventory-service': 'Inventory',
  'cart-service': 'Cart',
  'order-service': 'Order',
  'payment-service': 'Payment',
  'shipping-service': 'Shipping',
  'review-service': 'Review',
  'warranty-service': 'Warranty',
  'support-service': 'Support',
  'notification-service': 'Notification',
  'reporting-service': 'Reporting',
};

function prefixOperationIds(doc, serviceId) {
  const short = serviceId.replace(/-service$/u, '');
  const displayTag = SERVICE_DISPLAY_TAGS[serviceId] || short;
  for (const p of Object.keys(doc.paths || {})) {
    for (const method of Object.keys(doc.paths[p] || {})) {
      if (method.startsWith('x-')) continue;
      const op = doc.paths[p][method];
      if (!op || typeof op !== 'object') continue;
      const base = op.operationId || `${method}_${p}`;
      if (!String(base).startsWith(`${short}_`)) {
        op.operationId = `${short}_${base}`.replace(/[^a-zA-Z0-9._-]/g, '_');
      }
      // Single service tag for combined Swagger UI grouping.
      op.tags = [displayTag];
      op['x-nexatech-service'] = serviceId;
    }
  }
  return doc;
}

function main() {
  const combined = {
    openapi: '3.0.3',
    info: {
      title: 'NexaTech Combined API',
      description: [
        'Combined OpenAPI 3 specification for local security training.',
        'Import into Burp Suite, OWASP ZAP, Postman, Insomnia, or Swagger Editor.',
        'Prefer Kong server for gateway testing; direct ports for service debug.',
        'Contains no real secrets, passwords, or tokens.',
      ].join(' '),
      version: '1.0.0',
    },
    servers: [
      { url: KONG_URL, description: 'Kong Gateway (local)' },
      {
        url: 'http://localhost:{port}',
        description: 'Direct service (port 3001–3014)',
        variables: {
          port: {
            default: '3001',
            enum: SERVICES.map((s) => String(s.port)),
          },
        },
      },
      {
        url: 'https://api.example.invalid',
        description: 'Production placeholder',
      },
    ],
    tags: SERVICES.map((s) => ({
      name: SERVICE_DISPLAY_TAGS[s.id] || s.id.replace(/-service$/u, ''),
      description: s.description,
      'x-nexatech-service': s.id,
    })),
    paths: {},
    components: {
      securitySchemes: {
        bearer: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT from identity login — never commit real tokens',
        },
        userId: { type: 'apiKey', in: 'header', name: 'x-user-id' },
        userRoles: { type: 'apiKey', in: 'header', name: 'x-user-roles' },
        requestId: { type: 'apiKey', in: 'header', name: 'x-request-id' },
        traceId: { type: 'apiKey', in: 'header', name: 'x-trace-id' },
        idempotencyKey: {
          type: 'apiKey',
          in: 'header',
          name: 'Idempotency-Key',
        },
      },
      schemas: {
        ErrorEnvelope: {
          type: 'object',
          required: ['errorCode', 'message', 'details', 'traceId', 'timestamp'],
          properties: {
            errorCode: { type: 'string' },
            message: { type: 'string' },
            details: { type: 'object', additionalProperties: true },
            traceId: { type: 'string', format: 'uuid' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        PaginationMeta: {
          type: 'object',
          required: ['page', 'pageSize', 'totalItems', 'totalPages'],
          properties: {
            page: { type: 'integer' },
            pageSize: { type: 'integer' },
            totalItems: { type: 'integer' },
            totalPages: { type: 'integer' },
          },
        },
      },
      parameters: {
        TraceIdHeader: {
          name: 'x-trace-id',
          in: 'header',
          required: false,
          schema: { type: 'string', format: 'uuid' },
        },
        RequestIdHeader: {
          name: 'x-request-id',
          in: 'header',
          required: false,
          schema: { type: 'string', format: 'uuid' },
        },
        IdempotencyKeyHeader: {
          name: 'Idempotency-Key',
          in: 'header',
          required: false,
          schema: { type: 'string' },
        },
      },
    },
    'x-nexatech-webhooks': {
      description:
        'VNPay and shipping provider callbacks live on payment-service and shipping-service specs. Production verifies signatures; security-lab may weaken checks intentionally.',
    },
    'x-nexatech-security-lab': {
      description:
        'Lab-only endpoints (e.g. /health/lab, /lab/ssrf-probe) appear when NEXATECH_SECURITY_LAB=1 and NEXATECH_DEPLOY_PROFILE=security-lab.',
    },
  };

  for (const service of SERVICES) {
    const doc = prefixOperationIds(loadServiceDoc(service.id), service.id);
    for (const [p, item] of Object.entries(doc.paths || {})) {
      combined.paths[p] = combined.paths[p]
        ? { ...combined.paths[p], ...item }
        : item;
    }
    for (const [name, schema] of Object.entries(
      (doc.components && doc.components.schemas) || {},
    )) {
      if (!combined.components.schemas[name]) {
        combined.components.schemas[name] = schema;
      }
    }
  }

  const sorted = sortObjectDeep(combined);
  sorted.openapi = '3.0.3';
  sorted.info = combined.info;
  sorted.servers = combined.servers;

  const outYaml = path.join(openapiDir, 'nexatech-combined.openapi.yaml');
  const outJson = path.join(openapiDir, 'nexatech-combined.openapi.json');
  fs.writeFileSync(
    outYaml,
    `# Generated by pnpm openapi:combine — Burp/ZAP/Postman import.\n# No secrets.\n${dumpYaml(sorted)}\n`,
    'utf8',
  );
  fs.writeFileSync(outJson, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
  console.log(
    `[openapi:combine] paths=${Object.keys(sorted.paths).length} → ${path.relative(root, outYaml)}`,
  );
}

main();
