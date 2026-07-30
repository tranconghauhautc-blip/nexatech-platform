import { Test, TestingModule } from '@nestjs/testing';
import { Roles } from '@nexatech/shared-auth';
import { createId } from '@nexatech/shared-platform';
import { AdminPaymentController } from './admin-payment.controller';
import { InMemoryEventPublisher } from './event-publisher';
import { MockPaymentController } from './mock-payment.controller';
import { InMemoryOrderClient } from './order.client';
import { PaymentController } from './payment.controller';
import { InMemoryPaymentRepository } from './payment.repository';
import { PaymentService } from './payment.service';
import { MockRefundAdapter } from './providers/refund-adapter';

process.env['NODE_ENV'] = 'test';
process.env['MOCK_PAYMENT_ENABLED'] = 'true';

describe('Payment controllers (API)', () => {
  let paymentController: PaymentController;
  let mockController: MockPaymentController;
  let adminController: AdminPaymentController;
  let orderClient: InMemoryOrderClient;

  beforeEach(async () => {
    orderClient = new InMemoryOrderClient();
    const service = new PaymentService(
      new InMemoryPaymentRepository(),
      orderClient,
      new InMemoryEventPublisher(),
      new MockRefundAdapter(),
      'http://localhost:3008',
    );

    const module: TestingModule = await Test.createTestingModule({
      controllers: [
        PaymentController,
        MockPaymentController,
        AdminPaymentController,
      ],
      providers: [{ provide: PaymentService, useValue: service }],
    }).compile();

    paymentController = module.get(PaymentController);
    mockController = module.get(MockPaymentController);
    adminController = module.get(AdminPaymentController);
  });

  function seedMockOrder(customerId: string) {
    const orderId = createId();
    orderClient.seed({
      id: orderId,
      orderCode: 'NXAPI001',
      customerId,
      status: 'AWAITING_PAYMENT',
      paymentMethod: 'MOCK',
      paymentStatus: 'PENDING',
      grandTotal: 1_500_000,
      currency: 'VND',
    });
    return orderId;
  }

  it('POST /payments creates payment', async () => {
    const orderId = seedMockOrder('api-cust');
    const dto = await paymentController.create('api-cust', Roles.Customer, {
      orderId,
      idempotencyKey: 'api-create-1',
    });
    expect(dto.amount).toBe(1_500_000);
    expect(dto.status).toBe('PENDING');
  });

  it('GET /payments/:id returns payment for owner', async () => {
    const orderId = seedMockOrder('api-get');
    const created = await paymentController.create('api-get', Roles.Customer, {
      orderId,
      idempotencyKey: 'api-get-1',
    });
    const fetched = await paymentController.get(
      created.id,
      'api-get',
      Roles.Customer,
    );
    expect(fetched.id).toBe(created.id);
  });

  it('mock succeed via controller', async () => {
    const orderId = seedMockOrder('api-mock');
    const created = await paymentController.create('api-mock', Roles.Customer, {
      orderId,
      idempotencyKey: 'api-mock-1',
    });
    const paid = await mockController.succeed(
      created.id,
      'api-mock',
      Roles.Customer,
    );
    expect(paid.status).toBe('PAID');
  });

  it('admin list returns paginated payments', async () => {
    const orderId = seedMockOrder('api-admin');
    await paymentController.create('api-admin', Roles.Customer, {
      orderId,
      idempotencyKey: 'api-admin-1',
    });
    const list = await adminController.list('staff-1', Roles.Staff, {});
    expect(list.items.length).toBeGreaterThanOrEqual(1);
  });
});
