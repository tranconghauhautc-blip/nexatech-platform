import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { setupNexaTechSwagger } from '@nexatech/shared-platform';
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

  const port = Number(process.env['ORDER_PORT'] ?? process.env['PORT'] ?? 3007);
  setupNexaTechSwagger(app, {
    title: 'NexaTech Order Service',
    description:
      'Đặt hàng, checkout, trạng thái đơn hàng, huỷ đơn và outbox event',
    serviceName: 'order-service',
    port,
  });

  await app.listen(port);
  Logger.log(`order-service listening on http://localhost:${port}/api`);
  Logger.log(`swagger: http://localhost:${port}/docs`);
}

bootstrap();
