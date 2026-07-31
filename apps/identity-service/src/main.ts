import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { setupNexaTechSwagger } from '@nexatech/shared-platform';
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
    ],
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

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
