import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { VulnCartExceptionFilter } from './common/http-exception.filter';
import { ErrorResponseDto } from './common/dto';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  // LAB Security Misconfiguration: reflect any Origin
  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.setGlobalPrefix('api', {
    exclude: ['health', 'health/live', 'health/ready'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      // LAB Mass Assignment: do NOT strip unknown properties
      whitelist: false,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new VulnCartExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('VulnCart API')
    .setDescription(
      [
        'VulnCart — intentionally vulnerable e-commerce API lab for Kubernetes.',
        '',
        'Vulnerabilities are **always on**. Use only in isolated lab clusters.',
        '',
        'Tags: Auth, Users, Products, Cart, Orders, Reviews, Admin, Lab.',
        '',
        'Swagger UI: `/api/docs` · OpenAPI JSON: `/api/docs-json`',
      ].join('\n'),
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token from POST /api/auth/login',
      },
      'bearer',
    )
    .addServer('/', 'Same-origin (Ingress)')
    .addTag('Auth', 'Register / login / logout')
    .addTag('Users', 'Profile and password')
    .addTag('Products', 'Catalog browse')
    .addTag('Cart', 'Cart mutations (business-logic vulns)')
    .addTag('Orders', 'Checkout and orders (IDOR)')
    .addTag('Reviews', 'Reviews (spam / IDOR)')
    .addTag('Admin', 'Admin operations (BFLA demos)')
    .addTag('Lab', 'SSRF, JWT alg=none, debug, inventory')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    extraModels: [ErrorResponseDto],
  });
  SwaggerModule.setup('api/docs', app, document, {
    useGlobalPrefix: false,
    jsonDocumentUrl: 'api/docs-json',
    yamlDocumentUrl: 'api/docs-yaml',
    customSiteTitle: 'VulnCart API Docs',
  });

  const port = Number(process.env['PORT'] || 3000);
  await app.listen(port);
  Logger.log(`VulnCart API listening on :${port}`);
  Logger.log(`Swagger UI: http://127.0.0.1:${port}/api/docs`);
}

bootstrap();
