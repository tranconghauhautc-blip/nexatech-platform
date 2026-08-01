import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { setupNexaTechSwagger, useNexaTechExceptionFilter } from '@nexatech/shared-platform';
import { resolveCorsOrigin } from '@nexatech/shared-security-lab';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  app.setGlobalPrefix('api', {
    exclude: [
      'health',
      'health/live',
      'health/ready',
      'health/lab',
      'health/debug',
      'api/v0/internal/routes',
      'lab/ssrf-probe',
      'lab/supply-chain',
      'lab/jwt-alg-none',
      'lab/reflect-headers',
      'lab/login-get',
      'lab/error-stack',
      'lab/api-inventory',
      'lab/set-cookie',
      'lab/verify-bypass',
      'lab/oauth-callback',
      'lab/content-type',
    ],
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  // SC-30 — reflect request Origin (always-on)
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean | string) => void,
    ) => {
      const resolved = resolveCorsOrigin({
        requestOrigin: origin,
        allowlist: [],
      });
      callback(null, resolved ?? true);
    },
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );
  useNexaTechExceptionFilter(app);

  const port = Number(
    process.env['IDENTITY_PORT'] ?? process.env['PORT'] ?? 3001,
  );
  setupNexaTechSwagger(app, {
    title: 'NexaTech Identity Service',
    description: 'Auth, session, OTP và RBAC',
    serviceName: 'identity-service',
    port,
  });

  await app.listen(port);
  Logger.log(`identity-service listening on http://localhost:${port}/api`);
  Logger.log(`swagger: http://localhost:${port}/docs`);
}

bootstrap();
