'use strict';

const fs = require('fs');
const path = require('path');

const services = [
  {
    id: 'identity-service',
    title: 'NexaTech Identity Service',
    description: 'Auth, session, OTP và RBAC',
    port: 3001,
    envPort: 'IDENTITY_PORT',
    exclude: [
      'health',
      'health/live',
      'health/ready',
      'health/lab',
      'health/debug',
      'api/v0/internal/routes',
      'lab/ssrf-probe',
    ],
  },
  {
    id: 'customer-service',
    title: 'NexaTech Customer Service',
    description: 'Hồ sơ khách hàng và địa chỉ',
    port: 3002,
    envPort: 'CUSTOMER_PORT',
  },
  {
    id: 'catalog-service',
    title: 'NexaTech Catalog Service',
    description: 'Danh mục, thương hiệu, sản phẩm, SKU và giá',
    port: 3003,
    envPort: 'CATALOG_PORT',
  },
  {
    id: 'media-service',
    title: 'NexaTech Media Service',
    description: 'Presign MinIO và metadata media',
    port: 3004,
    envPort: 'MEDIA_PORT',
  },
  {
    id: 'inventory-service',
    title: 'NexaTech Inventory Service',
    description: 'Kho, cửa hàng, tồn, giữ và điều chuyển',
    port: 3005,
    envPort: 'INVENTORY_PORT',
  },
  {
    id: 'cart-service',
    title: 'NexaTech Cart Service',
    description: 'Giỏ hàng, wishlist, so sánh và sản phẩm đã xem',
    port: 3006,
    envPort: 'CART_PORT',
  },
  {
    id: 'order-service',
    title: 'NexaTech Order Service',
    description:
      'Đặt hàng, checkout, trạng thái đơn hàng, huỷ đơn và outbox event',
    port: 3007,
    envPort: 'ORDER_PORT',
  },
  {
    id: 'payment-service',
    title: 'NexaTech Payment Service',
    description: 'COD, mock payment, VNPay sandbox và hoàn tiền',
    port: 3008,
    envPort: 'PAYMENT_PORT',
  },
  {
    id: 'shipping-service',
    title: 'NexaTech Shipping Service',
    description: 'Báo giá, shipment, GHN/mock và webhook vận chuyển',
    port: 3009,
    envPort: 'SHIPPING_PORT',
  },
  {
    id: 'review-service',
    title: 'NexaTech Review Service',
    description: 'Đánh giá sản phẩm, kiểm duyệt và media đánh giá',
    port: 3010,
    envPort: 'REVIEW_PORT',
  },
  {
    id: 'warranty-service',
    title: 'NexaTech Warranty Service',
    description: 'Bảo hành, đổi trả và đồng bộ đơn hàng',
    port: 3011,
    envPort: 'WARRANTY_PORT',
  },
  {
    id: 'support-service',
    title: 'NexaTech Support Service',
    description: 'Ticket hỗ trợ và hội thoại',
    port: 3012,
    envPort: 'SUPPORT_PORT',
  },
  {
    id: 'notification-service',
    title: 'NexaTech Notification Service',
    description: 'Thông báo in-app, email và RabbitMQ',
    port: 3013,
    envPort: 'NOTIFICATION_PORT',
  },
  {
    id: 'reporting-service',
    title: 'NexaTech Reporting Service',
    description: 'Dashboard admin và audit projection',
    port: 3014,
    envPort: 'REPORTING_PORT',
  },
];

const root = path.resolve(__dirname, '../..');

for (const svc of services) {
  const exclude = svc.exclude || ['health', 'health/live', 'health/ready'];
  const excludeBlock = exclude.map((e) => `      '${e}',`).join('\n');
  const content = `import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { setupNexaTechSwagger } from '@nexatech/shared-platform';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  app.setGlobalPrefix('api', {
    exclude: [
${excludeBlock}
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
    process.env['${svc.envPort}'] ?? process.env['PORT'] ?? ${svc.port},
  );
  setupNexaTechSwagger(app, {
    title: '${svc.title}',
    description: '${svc.description}',
    serviceName: '${svc.id}',
    port,
  });

  await app.listen(port);
  Logger.log(\`${svc.id} listening on http://localhost:\${port}/api\`);
  Logger.log(\`swagger: http://localhost:\${port}/docs\`);
}

bootstrap();
`;
  const filePath = path.join(root, 'apps', svc.id, 'src', 'main.ts');
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('updated', filePath);
}
