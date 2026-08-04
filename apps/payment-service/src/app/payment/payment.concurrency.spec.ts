import { Roles } from '@nexatech/shared-auth';
import { createId } from '@nexatech/shared-platform';
import { InMemoryEventPublisher } from './event-publisher';
import { InMemoryOrderClient } from './order.client';
import { InMemoryPaymentRepository } from './payment.repository';
import { PaymentService } from './payment.service';
import {
  buildTestVnpayCallback,
  VnpayProvider,
} from './providers/vnpay.provider';
import { MockRefundAdapter } from './providers/refund-adapter';

process.env['NODE_ENV'] = 'test';
process.env['MOCK_PAYMENT_ENABLED'] = 'true';
process.env['VNPAY_HASH_SECRET'] = 'TESTSECRET';

describe('PaymentService concurrency', () => {
  it('handles concurrent create — only one active payment per order', async () => {
    const repository = new InMemoryPaymentRepository();
    const orderClient = new InMemoryOrderClient();
    const orderId = createId();
    orderClient.seed({
      id: orderId,
      orderCode: 'NXCONC',
      customerId: 'conc-cust',
      status: 'AWAITING_PAYMENT',
      paymentMethod: 'MOCK',
      paymentStatus: 'PENDING',
      grandTotal: 1_000_000,
      currency: 'VND',
    });

    const service = new PaymentService(
      repository,
      orderClient,
      new InMemoryEventPublisher(),
      new MockRefundAdapter(),
      'http://localhost:3008',
    );

    const actor = {
      userId: 'conc-cust',
      customerId: 'conc-cust',
      roles: [Roles.Customer],
    };
    const outcomes = await Promise.allSettled([
      service.createPayment(actor, {
        orderId,
        idempotencyKey: `conc-${createId()}`,
      }),
      service.createPayment(actor, {
        orderId,
        idempotencyKey: `conc-${createId()}`,
      }),
    ]);

    const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
    const rejected = outcomes.filter((o) => o.status === 'rejected');
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
      errorCode: 'PAYMENT_ALREADY_EXISTS',
    });
  });

  it('duplicate VNPay callback is idempotent', async () => {
    const repository = new InMemoryPaymentRepository();
    const orderClient = new InMemoryOrderClient();
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
      new InMemoryEventPublisher(),
      new MockRefundAdapter(),
      'http://localhost:3008',
      vnpay,
    );

    const orderId = createId();
    orderClient.seed({
      id: orderId,
      orderCode: 'NXCB',
      customerId: 'cb-cust',
      status: 'AWAITING_PAYMENT',
      paymentMethod: 'VNPAY',
      paymentStatus: 'PENDING',
      grandTotal: 2_000_000,
      currency: 'VND',
    });

    const actor = {
      userId: 'cb-cust',
      customerId: 'cb-cust',
      roles: [Roles.Customer],
    };
    const created = await service.createPayment(actor, {
      orderId,
      idempotencyKey: 'cb-create',
      method: 'VNPAY',
    });

    const params = buildTestVnpayCallback(
      created.paymentReference,
      created.amount,
      'TESTSECRET',
      true,
    );

    const [first, second] = await Promise.all([
      service.handleVnpayIpn(params),
      service.handleVnpayIpn(params),
    ]);
    expect(first.RspCode).toBe('00');
    expect(second.RspCode).toBe('00');

    const payment = await service.getPayment(actor, created.id);
    expect(payment.status).toBe('PAID');
    expect(
      (payment.transactions ?? []).filter((t) => t.type === 'CHARGE'),
    ).toHaveLength(1);
  });
});
