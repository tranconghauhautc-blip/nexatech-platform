import type { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from '@nestjs/swagger';

export interface NexaTechSwaggerOptions {
  title: string;
  description: string;
  serviceName: string;
  port: number;
  version?: string;
}

const ERROR_ENVELOPE_SCHEMA = {
  type: 'object' as const,
  required: ['errorCode', 'message', 'details', 'traceId', 'timestamp'],
  properties: {
    errorCode: { type: 'string', example: 'UNAUTHORIZED' },
    message: { type: 'string', example: 'Email hoặc mật khẩu không đúng' },
    details: { type: 'object', additionalProperties: true },
    traceId: {
      type: 'string',
      format: 'uuid',
      example: '00000000-0000-4000-8000-000000000001',
    },
    timestamp: { type: 'string', format: 'date-time' },
  },
};

const PAGINATION_META_SCHEMA = {
  type: 'object' as const,
  required: ['page', 'pageSize', 'totalItems', 'totalPages'],
  properties: {
    page: { type: 'integer', example: 1 },
    pageSize: { type: 'integer', example: 20 },
    totalItems: { type: 'integer', example: 100 },
    totalPages: { type: 'integer', example: 5 },
  },
};

/**
 * Build OpenAPI 3 document with local/Kong/production servers,
 * Bearer + gateway header security schemes, and shared schemas.
 */
export function buildNexaTechOpenApiDocument(
  app: INestApplication,
  options: NexaTechSwaggerOptions,
): OpenAPIObject {
  const version = options.version ?? '1.0.0';
  const config = new DocumentBuilder()
    .setTitle(options.title)
    .setDescription(
      [
        options.description,
        '',
        'Local security training lab: use Swagger Authorize with JWT from identity login,',
        'or gateway trust headers (`x-user-id`, `x-user-roles`) behind Kong/BFF.',
        'Do not paste production secrets. Security-lab intentional vulns require lab deploy profile.',
      ].join('\n'),
    )
    .setVersion(version)
    .addServer(
      `http://localhost:${options.port}`,
      `${options.serviceName} direct (local)`,
    )
    .addServer('http://localhost:8000', 'Kong Gateway (local)')
    .addServer(
      'https://api.example.invalid',
      'Production placeholder (replace; never commit real hosts with secrets)',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'JWT access token from POST /api/v1/auth/login (identity-service). Prefer Authorize button; do not log refresh tokens.',
      },
      'bearer',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'x-user-id',
        description: 'Trusted actor user id when request is from Kong/BFF',
      },
      'userId',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'x-user-roles',
        description: 'Comma-separated roles (e.g. Staff,Manager)',
      },
      'userRoles',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'x-request-id',
        description: 'Client/request correlation id',
      },
      'requestId',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'x-trace-id',
        description: 'Distributed trace id',
      },
      'traceId',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'Idempotency-Key',
        description: 'Idempotent write key (scoped per user in secure profile)',
      },
      'idempotencyKey',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey: string, methodKey: string) => {
      const controller = controllerKey.replace(/Controller$/u, '');
      return `${controller}_${methodKey}`;
    },
  });

  // Ensure v1/v2 mirrors get unique operationIds (Nest may emit same methodKey twice).
  const seen = new Map<string, number>();
  for (const pathKey of Object.keys(document.paths ?? {})) {
    const item = document.paths?.[pathKey];
    if (!item) continue;
    for (const method of Object.keys(item)) {
      if (method.startsWith('x-')) continue;
      const op = (item as Record<string, { operationId?: string }>)[method];
      if (!op || typeof op !== 'object') continue;
      const base = op.operationId || `${method}_${pathKey}`;
      const versionMatch = /\/api\/(v\d+)\//u.exec(pathKey);
      const versionSuffix = versionMatch?.[1] ? `_${versionMatch[1]}` : '';
      let candidate = `${base}${versionSuffix}`;
      const count = seen.get(candidate) ?? 0;
      seen.set(candidate, count + 1);
      if (count > 0) candidate = `${candidate}_${count + 1}`;
      op.operationId = candidate.replace(/[^a-zA-Z0-9._-]/g, '_');
    }
  }
  document.components = document.components ?? {};
  document.components.schemas = {
    ...document.components.schemas,
    ErrorEnvelope: ERROR_ENVELOPE_SCHEMA,
    PaginationMeta: PAGINATION_META_SCHEMA,
  };

  return document;
}

/** Mount Swagger UI at `/docs` and OpenAPI JSON at `/docs-json`. */
export function setupNexaTechSwagger(
  app: INestApplication,
  options: NexaTechSwaggerOptions,
): OpenAPIObject {
  const document = buildNexaTechOpenApiDocument(app, options);
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs-json',
    yamlDocumentUrl: 'docs-yaml',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      tryItOutEnabled: true,
      docExpansion: 'list',
      filter: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: `${options.title} — Swagger`,
  });
  return document;
}
