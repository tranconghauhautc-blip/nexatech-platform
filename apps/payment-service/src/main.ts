import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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

  const swagger = new DocumentBuilder()
    .setTitle('NexaTech Payment Service')
    .setDescription(
      'Thanh toán COD, mock và VNPay Sandbox; hoàn tiền; đồng bộ trạng thái đơn hàng',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));

  const port = Number(
    process.env['PAYMENT_PORT'] ?? process.env['PORT'] ?? 3008,
  );
  await app.listen(port);
  Logger.log(`payment-service listening on http://localhost:${port}/api`);
  Logger.log(`swagger: http://localhost:${port}/docs`);
}

bootstrap();
