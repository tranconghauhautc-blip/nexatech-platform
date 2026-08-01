import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  setupNexaTechSwagger,
  useNexaTechExceptionFilter,
} from '@nexatech/shared-platform';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  app.setGlobalPrefix('api', {
    exclude: ['health', 'health/live', 'health/ready'],
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );
  useNexaTechExceptionFilter(app);

  const port = Number(
    process.env['INVENTORY_PORT'] ?? process.env['PORT'] ?? 3005,
  );
  setupNexaTechSwagger(app, {
    title: 'NexaTech Inventory Service',
    description: 'Kho, cửa hàng, tồn, giữ và điều chuyển',
    serviceName: 'inventory-service',
    port,
  });

  await app.listen(port);
  Logger.log(`inventory-service listening on http://localhost:${port}/api`);
  Logger.log(`swagger: http://localhost:${port}/docs`);
}

bootstrap();
