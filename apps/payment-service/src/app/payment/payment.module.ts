import { Module } from '@nestjs/common';
import { AdminPaymentController } from './admin-payment.controller';
import {
  InMemoryEventPublisher,
  RabbitMqEventPublisher,
  type PaymentEventPublisher,
} from './event-publisher';
import { MockPaymentController } from './mock-payment.controller';
import {
  HttpOrderClient,
  InMemoryOrderClient,
  type OrderClient,
} from './order.client';
import { PaymentController } from './payment.controller';
import {
  InMemoryPaymentRepository,
  PAYMENT_REPOSITORY,
  type PaymentRepository,
} from './payment.repository';
import { PaymentService } from './payment.service';
import { PrismaPaymentRepository } from './prisma-payment.repository';
import { PrismaService } from './prisma.service';
import { MockRefundAdapter } from './providers/refund-adapter';
import { VnpayController } from './vnpay.controller';

export const PAYMENT_EVENT_PUBLISHER = Symbol('PAYMENT_EVENT_PUBLISHER');
export const ORDER_CLIENT = Symbol('ORDER_CLIENT');
export const REFUND_ADAPTER = Symbol('REFUND_ADAPTER');

function createRepositoryProvider() {
  const dbUrl =
    process.env['PAYMENT_DATABASE_URL'] ?? process.env['DATABASE_URL'];
  if (dbUrl) {
    return [
      PrismaService,
      {
        provide: PAYMENT_REPOSITORY,
        useFactory: (prisma: PrismaService): PaymentRepository =>
          new PrismaPaymentRepository(prisma),
        inject: [PrismaService],
      },
    ];
  }
  if (process.env['NODE_ENV'] === 'test') {
    return [
      {
        provide: PAYMENT_REPOSITORY,
        useClass: InMemoryPaymentRepository,
      },
    ];
  }
  throw new Error(
    'PAYMENT_DATABASE_URL bắt buộc khi chạy payment-service (trừ NODE_ENV=test)',
  );
}

function createPublisherProvider() {
  const rabbitUrl = process.env['RABBITMQ_URL'];
  if (rabbitUrl && process.env['NODE_ENV'] !== 'test') {
    return {
      provide: PAYMENT_EVENT_PUBLISHER,
      useFactory: (): PaymentEventPublisher =>
        new RabbitMqEventPublisher(rabbitUrl),
    };
  }
  return {
    provide: PAYMENT_EVENT_PUBLISHER,
    useClass: InMemoryEventPublisher,
  };
}

function createOrderClientProvider() {
  const orderUrl = process.env['ORDER_SERVICE_URL'];
  if (orderUrl && process.env['NODE_ENV'] !== 'test') {
    return {
      provide: ORDER_CLIENT,
      useFactory: (): OrderClient => new HttpOrderClient(orderUrl),
    };
  }
  return {
    provide: ORDER_CLIENT,
    useClass: InMemoryOrderClient,
  };
}

@Module({
  controllers: [
    PaymentController,
    MockPaymentController,
    VnpayController,
    AdminPaymentController,
  ],
  providers: [
    ...createRepositoryProvider(),
    createPublisherProvider(),
    createOrderClientProvider(),
    {
      provide: REFUND_ADAPTER,
      useClass: MockRefundAdapter,
    },
    {
      provide: PaymentService,
      useFactory: (
        repository: PaymentRepository,
        orderClient: OrderClient,
        publisher: PaymentEventPublisher,
        refundAdapter: MockRefundAdapter,
      ) =>
        new PaymentService(repository, orderClient, publisher, refundAdapter),
      inject: [
        PAYMENT_REPOSITORY,
        ORDER_CLIENT,
        PAYMENT_EVENT_PUBLISHER,
        REFUND_ADAPTER,
      ],
    },
  ],
})
export class PaymentModule {}
