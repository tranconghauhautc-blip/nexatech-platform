import { Roles } from '@nexatech/shared-auth';
import { ErrorCodes } from '@nexatech/shared-errors';
import { EventTypes } from '@nexatech/shared-events';
import { createId } from '@nexatech/shared-platform';
import { InMemoryEventPublisher } from './event-publisher';
import { InMemoryOrderClient } from './order.client';
import { InMemoryPaymentRepository } from './payment.repository';
import { PaymentService, type PaymentActor } from './payment.service';
import type { OrderSnapshot } from './payment.types';
import { MockRefundAdapter } from './providers/refund-adapter';
import {
  VnpayProvider,
  buildTestVnpayCallback,
} from './providers/vnpay.provider';

process.env['NODE_ENV'] = 'test';
process.env['MOCK_PAYMENT_ENABLED'] = 'true';
process.env['VNPAY_HASH_SECRET'] = 'TESTSECRET';

function customerActor(id: string): PaymentActor {
  return { userId: id, customerId: id, roles: [Roles.Customer] };
}

function staffActor(): PaymentActor {
  return { userId: 'staff-1', roles: [Roles.Staff] };
}

function seedOrder(
  client: InMemoryOrderClient,
  overrides: Partial<OrderSnapshot> & { id: string; customerId: string },
): OrderSnapshot {
  const order: OrderSnapshot = {
    orderCode: overrides.orderCode ?? `NX${createId().slice(0, 8)}`,
    status: overrides.status ?? 'AWAITING_PAYMENT',
    paymentMethod: overrides.paymentMethod ?? 'MOCK',
    paymentStatus: overrides.paymentStatus ?? 'PENDING',
    grandTotal: overrides.grandTotal ?? 2_000_000,
    currency: 'VND',
    ...overrides,
  };
  client.seed(order);
  return order;
}

function setup() {
  const repository = new InMemoryPaymentRepository();
  const orderClient = new InMemoryOrderClient();
  const publisher = new InMemoryEventPublisher();
  const vnpay = new VnpayProvider({
    tmnCode: 'TESTTMN',
    hashSecret: 'TESTSECRET',
    paymentUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
    returnUrl: 'http://localhost:3008/api/v1/vnpay/return',
    ipnUrl: 'http://localhost:3008/api/v1/vnpay/ipn',
  });
  const service = new PaymentService(
    repository,
    orderClient,
    publisher,
    new MockRefundAdapter(),
    'http://localhost:3008',
    vnpay,
  );
  return { repository, orderClient, publisher, service };
}

function createPaymentBody(orderId: string, idempotencyKey?: string) {
  return {
    orderId,
    idempotencyKey: idempotencyKey ?? `idem-${createId()}`,
  };
}

describe('PaymentService', () => {
  it('creates MOCK payment from order grandTotal with outbox events', async () => {
    const { orderClient, publisher, service } = setup();
    const order = seedOrder(orderClient, {
      id: createId(),
      customerId: 'cust-1',
      paymentMethod: 'MOCK',
      status: 'AWAITING_PAYMENT',
      grandTotal: 3_500_000,
    });

    const dto = await service.createPayment(
      customerActor('cust-1'),
      createPaymentBody(order.id, 'create-mock-1'),
    );

    expect(dto.status).toBe('PENDING');
    expect(dto.amount).toBe(3_500_000);
    expect(dto.checkoutUrl).toContain('/mock-payments/');
    expect(
      publisher.published.some(
        (e) => e.eventType === EventTypes.PAYMENT_PENDING,
      ),
    ).toBe(true);
  });

  it('creates COD payment as PENDING without checkout URL', async () => {
    const { orderClient, service } = setup();
    const order = seedOrder(orderClient, {
      id: createId(),
      customerId: 'cust-cod',
      paymentMethod: 'COD',
      status: 'CONFIRMED',
      paymentStatus: 'UNPAID',
    });

    const dto = await service.createPayment(
      customerActor('cust-cod'),
      createPaymentBody(order.id),
    );
    expect(dto.provider).toBe('COD');
    expect(dto.status).toBe('PENDING');
    expect(dto.checkoutUrl).toBeUndefined();
  });

  it('rejects wrong customer (ownership)', async () => {
    const { orderClient, service } = setup();
    const order = seedOrder(orderClient, {
      id: createId(),
      customerId: 'owner-1',
    });
    await expect(
      service.createPayment(
        customerActor('other-user'),
        createPaymentBody(order.id),
      ),
    ).rejects.toMatchObject({ errorCode: ErrorCodes.PAYMENT_FORBIDDEN });
  });

  it('rejects duplicate active payment', async () => {
    const { orderClient, service } = setup();
    const order = seedOrder(orderClient, {
      id: createId(),
      customerId: 'cust-dup',
    });
    await service.createPayment(
      customerActor('cust-dup'),
      createPaymentBody(order.id, 'dup-key-001'),
    );
    await expect(
      service.createPayment(
        customerActor('cust-dup'),
        createPaymentBody(order.id, 'dup-key-002'),
      ),
    ).rejects.toMatchObject({ errorCode: ErrorCodes.PAYMENT_ALREADY_EXISTS });
  });

  it('is idempotent on create', async () => {
    const { orderClient, service } = setup();
    const order = seedOrder(orderClient, {
      id: createId(),
      customerId: 'cust-idem',
    });
    const body = createPaymentBody(order.id, 'idem-same');
    const first = await service.createPayment(customerActor('cust-idem'), body);
    const second = await service.createPayment(
      customerActor('cust-idem'),
      body,
    );
    expect(second.id).toBe(first.id);
  });

  it('mock succeed marks PAID and syncs order', async () => {
    const { orderClient, publisher, service } = setup();
    const order = seedOrder(orderClient, {
      id: createId(),
      customerId: 'cust-mock',
    });
    const created = await service.createPayment(
      customerActor('cust-mock'),
      createPaymentBody(order.id),
    );
    const paid = await service.mockSucceed(
      customerActor('cust-mock'),
      created.id,
    );
    expect(paid.status).toBe('PAID');
    expect(orderClient.syncCalls.length).toBeGreaterThanOrEqual(1);
    expect(orderClient.syncCalls[0]?.input.confirmOrder).toBe(true);
    expect(
      publisher.published.some(
        (e) => e.eventType === EventTypes.PAYMENT_SUCCEEDED,
      ),
    ).toBe(true);
  });

  it('mock fail transitions to FAILED', async () => {
    const { orderClient, service } = setup();
    const order = seedOrder(orderClient, {
      id: createId(),
      customerId: 'cust-fail',
    });
    const created = await service.createPayment(
      customerActor('cust-fail'),
      createPaymentBody(order.id),
    );
    const failed = await service.mockFail(
      customerActor('cust-fail'),
      created.id,
    );
    expect(failed.status).toBe('FAILED');
  });

  it('expires payment past expiresAt', async () => {
    jest.useFakeTimers();
    const { orderClient, service } = setup();
    const order = seedOrder(orderClient, {
      id: createId(),
      customerId: 'cust-exp',
    });
    const created = await service.createPayment(
      customerActor('cust-exp'),
      createPaymentBody(order.id),
    );
    jest.advanceTimersByTime(31 * 60 * 1000);
    const dto = await service.getPayment(customerActor('cust-exp'), created.id);
    expect(dto.status).toBe('EXPIRED');
    jest.useRealTimers();
  });

  it('full and partial refund', async () => {
    const { orderClient, service } = setup();
    const order = seedOrder(orderClient, {
      id: createId(),
      customerId: 'cust-ref',
      grandTotal: 1_000_000,
    });
    const created = await service.createPayment(
      customerActor('cust-ref'),
      createPaymentBody(order.id),
    );
    await service.mockSucceed(customerActor('cust-ref'), created.id);

    const partial = await service.createRefund(
      customerActor('cust-ref'),
      created.id,
      {
        amount: 400_000,
        reason: 'Hoàn một phần',
        idempotencyKey: 'ref-partial-1',
      },
    );
    expect(partial.amount).toBe(400_000);

    const payment = await service.getPayment(
      customerActor('cust-ref'),
      created.id,
    );
    expect(payment.status).toBe('PARTIALLY_REFUNDED');
    expect(payment.amountRefunded).toBe(400_000);

    await service.createRefund(customerActor('cust-ref'), created.id, {
      amount: 600_000,
      reason: 'Hoàn phần còn lại',
      idempotencyKey: 'ref-full-2',
    });
    const full = await service.getPayment(
      customerActor('cust-ref'),
      created.id,
    );
    expect(full.status).toBe('REFUNDED');
  });

  it('rejects refund exceeding paid amount', async () => {
    const { orderClient, service } = setup();
    const order = seedOrder(orderClient, {
      id: createId(),
      customerId: 'cust-over',
      grandTotal: 500_000,
    });
    const created = await service.createPayment(
      customerActor('cust-over'),
      createPaymentBody(order.id),
    );
    await service.mockSucceed(customerActor('cust-over'), created.id);
    await expect(
      service.createRefund(customerActor('cust-over'), created.id, {
        amount: 600_000,
        reason: 'Quá số tiền',
        idempotencyKey: 'ref-over',
      }),
    ).rejects.toMatchObject({
      errorCode: ErrorCodes.PAYMENT_REFUND_EXCEEDS_PAID,
    });
  });

  it('rejects double refund with same idempotency key', async () => {
    const { orderClient, service } = setup();
    const order = seedOrder(orderClient, {
      id: createId(),
      customerId: 'cust-double',
    });
    const created = await service.createPayment(
      customerActor('cust-double'),
      createPaymentBody(order.id),
    );
    await service.mockSucceed(customerActor('cust-double'), created.id);
    const body = {
      amount: 100_000,
      reason: 'Test',
      idempotencyKey: 'ref-double-key',
    };
    const first = await service.createRefund(
      customerActor('cust-double'),
      created.id,
      body,
    );
    const second = await service.createRefund(
      customerActor('cust-double'),
      created.id,
      body,
    );
    expect(second.id).toBe(first.id);
  });

  it('handles VNPay IPN with valid signature', async () => {
    const { orderClient, service } = setup();
    const order = seedOrder(orderClient, {
      id: createId(),
      customerId: 'cust-vnp',
      paymentMethod: 'VNPAY',
    });
    const created = await service.createPayment(customerActor('cust-vnp'), {
      ...createPaymentBody(order.id),
      method: 'VNPAY',
    });
    const params = buildTestVnpayCallback(
      created.paymentReference,
      created.amount,
      'TESTSECRET',
      true,
    );
    const ipn = await service.handleVnpayIpn(params);
    expect(ipn.RspCode).toBe('00');
    const paid = await service.getPayment(
      customerActor('cust-vnp'),
      created.id,
    );
    expect(paid.status).toBe('PAID');
  });

  it('VNPay IPN rejects invalid signature', async () => {
    const { orderClient, service } = setup();
    const order = seedOrder(orderClient, {
      id: createId(),
      customerId: 'cust-bad-sig',
      paymentMethod: 'VNPAY',
    });
    const created = await service.createPayment(customerActor('cust-bad-sig'), {
      ...createPaymentBody(order.id),
      method: 'VNPAY',
    });
    const params = buildTestVnpayCallback(
      created.paymentReference,
      created.amount,
      'TESTSECRET',
    );
    params['vnp_SecureHash'] = 'bad';
    const ipn = await service.handleVnpayIpn(params);
    expect(ipn.RspCode).toBe('97');
  });

  it('markCodCollected is idempotent', async () => {
    const { orderClient, service } = setup();
    const order = seedOrder(orderClient, {
      id: createId(),
      customerId: 'cust-cod-collect',
      paymentMethod: 'COD',
      status: 'CONFIRMED',
      paymentStatus: 'UNPAID',
    });
    const created = await service.createPayment(
      customerActor('cust-cod-collect'),
      createPaymentBody(order.id),
    );
    const first = await service.markCodCollected(staffActor(), created.id);
    const second = await service.markCodCollected(staffActor(), created.id);
    expect(first.status).toBe('PAID');
    expect(second.status).toBe('PAID');
  });

  it('admin list requires staff role', async () => {
    const { service } = setup();
    await expect(
      service.adminListPayments(customerActor('cust-1'), {}),
    ).rejects.toMatchObject({ errorCode: ErrorCodes.FORBIDDEN });
  });
});
