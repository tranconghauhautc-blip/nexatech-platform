'use strict';

/**
 * Minimal deterministic JSON → YAML (OpenAPI-friendly).
 * Avoids adding a YAML dependency; stable key order via Object.keys insertion order.
 */
function escapeYamlString(value) {
  if (value === '') return "''";
  if (
    /[:#{}[\],&*?|!<>=%@`]/.test(value) ||
    /^(true|false|null|~|yes|no)$/i.test(value) ||
    /^[-?]/.test(value) ||
    /\n|\r/.test(value) ||
    value.includes("'") ||
    value.includes('"') ||
    /^0\d/.test(value)
  ) {
    return JSON.stringify(value);
  }
  return value;
}

function dumpYaml(value, indent = 0) {
  const pad = '  '.repeat(indent);
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'string') return escapeYamlString(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return value
      .map((item) => {
        if (item !== null && typeof item === 'object') {
          const nested = dumpYaml(item, indent + 1);
          return `${pad}- ${nested.replace(/^\s+/, '')}`;
        }
        return `${pad}- ${dumpYaml(item, 0)}`;
      })
      .join('\n');
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) return '{}';
    return keys
      .map((key) => {
        const child = value[key];
        if (child !== null && typeof child === 'object') {
          if (Array.isArray(child) && child.length === 0) {
            return `${pad}${key}: []`;
          }
          if (!Array.isArray(child) && Object.keys(child).length === 0) {
            return `${pad}${key}: {}`;
          }
          if (Array.isArray(child)) {
            return `${pad}${key}:\n${dumpYaml(child, indent + 1)}`;
          }
          return `${pad}${key}:\n${dumpYaml(child, indent + 1)}`;
        }
        return `${pad}${key}: ${dumpYaml(child, 0)}`;
      })
      .join('\n');
  }
  return JSON.stringify(String(value));
}

function sortObjectDeep(value) {
  if (Array.isArray(value)) return value.map(sortObjectDeep);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = sortObjectDeep(value[key]);
    }
    return out;
  }
  return value;
}

/**
 * Normalize OpenAPI document for deterministic repo diffs.
 * Keeps info/servers/paths/components in stable shape; does not invent endpoints.
 */
function normalizeOpenApiDocument(doc, service) {
  const normalized = sortObjectDeep(doc);
  normalized.openapi = normalized.openapi || '3.0.3';
  normalized.info = {
    title: service.title,
    description: service.description,
    version: (doc.info && doc.info.version) || '1.0.0',
  };
  normalized.servers = [
    {
      url: `http://localhost:${service.port}`,
      description: `${service.id} direct (local)`,
    },
    { url: 'http://localhost:8000', description: 'Kong Gateway (local)' },
    {
      url: 'https://api.example.invalid',
      description: 'Production placeholder',
    },
  ];
  normalized.components = normalized.components || {};
  normalized.components.securitySchemes = {
    ...(normalized.components.securitySchemes || {}),
    bearer: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description:
        'JWT access token from identity POST /api/v1/auth/login. Never commit real tokens.',
    },
    userId: {
      type: 'apiKey',
      in: 'header',
      name: 'x-user-id',
    },
    userRoles: {
      type: 'apiKey',
      in: 'header',
      name: 'x-user-roles',
    },
    requestId: {
      type: 'apiKey',
      in: 'header',
      name: 'x-request-id',
    },
    traceId: {
      type: 'apiKey',
      in: 'header',
      name: 'x-trace-id',
    },
    idempotencyKey: {
      type: 'apiKey',
      in: 'header',
      name: 'Idempotency-Key',
    },
  };
  normalized.components.schemas = {
    ...(normalized.components.schemas || {}),
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
  };
  if (!normalized.paths) normalized.paths = {};

  const forbiddenHeaders = new Set([
    'accept',
    'accept-charset',
    'accept-encoding',
    'access-control-request-headers',
    'access-control-request-method',
    'connection',
    'content-length',
    'cookie',
    'cookie2',
    'date',
    'dnt',
    'expect',
    'host',
    'keep-alive',
    'origin',
    'referer',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
    'via',
    'user-agent',
  ]);

  // Make operationIds unique across /api/v1 and /api/v2 mirrors.
  // Also drop browser-forbidden header params (e.g. user-agent on login).
  const seen = new Map();
  for (const pathKey of Object.keys(normalized.paths)) {
    const item = normalized.paths[pathKey];
    if (!item || typeof item !== 'object') continue;
    for (const method of Object.keys(item)) {
      if (method.startsWith('x-')) continue;
      const op = item[method];
      if (!op || typeof op !== 'object') continue;
      if (Array.isArray(op.parameters)) {
        op.parameters = op.parameters.filter((param) => {
          if (!param || typeof param !== 'object' || param.$ref) return true;
          if (param.in !== 'header' || typeof param.name !== 'string') {
            return true;
          }
          return !forbiddenHeaders.has(String(param.name).toLowerCase());
        });
        if (op.parameters.length === 0) delete op.parameters;
      }
      const versionMatch = /\/api\/(v\d+)\//.exec(pathKey);
      const versionSuffix = versionMatch ? `_${versionMatch[1]}` : '';
      const base = op.operationId || `${method}_${pathKey}`;
      let candidate = `${base}${base.includes(versionSuffix) ? '' : versionSuffix}`;
      candidate = String(candidate).replace(/[^a-zA-Z0-9._-]/g, '_');
      const count = seen.get(candidate) || 0;
      seen.set(candidate, count + 1);
      if (count > 0) candidate = `${candidate}_${count + 1}`;
      op.operationId = candidate;
    }
  }

  return normalized;
}

module.exports = {
  dumpYaml,
  normalizeOpenApiDocument,
  sortObjectDeep,
};
