import { createId } from '@nexatech/shared-platform';
import { InMemoryPaymentRepository } from './payment.repository';
import { PrismaPaymentRepository } from './prisma-payment.repository';
import { PrismaService } from './prisma.service';

const describeIfDb = process.env['PAYMENT_DATABASE_URL']
  ? describe
  : describe.skip;

describeIfDb('PrismaPaymentRepository integration', () => {
  let prisma: PrismaService;
  let repository: PrismaPaymentRepository;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    repository = new PrismaPaymentRepository(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates and finds payment', async () => {
    const id = createId();
    const ref = `PAY-INT-${createId().slice(0, 8)}`;
    const payment = await repository.createPayment({
      id,
      paymentReference: ref,
      orderId: createId(),
      orderCode: 'NXINT001',
      customerId: 'cust-int',
      provider: 'MOCK',
      method: 'MOCK',
      status: 'PENDING',
      amount: 1_000_000,
      currency: 'VND',
      attempt: { attemptNumber: 1, status: 'PENDING' },
      outboxEvents: [],
      actorId: 'test',
    });

    expect(payment.id).toBe(id);
    const found = await repository.findByReference(ref);
    expect(found?.amount).toBe(1_000_000);
  });
});

describe('InMemoryPaymentRepository', () => {
  it('enforces single active payment per order', async () => {
    const repo = new InMemoryPaymentRepository();
    const orderId = createId();
    await repo.createPayment({
      id: createId(),
      paymentReference: 'PAY-A',
      orderId,
      orderCode: 'NX1',
      customerId: 'c1',
      provider: 'MOCK',
      method: 'MOCK',
      status: 'PENDING',
      amount: 100,
      currency: 'VND',
      attempt: { attemptNumber: 1, status: 'PENDING' },
      outboxEvents: [],
      actorId: 'test',
    });

    await expect(
      repo.createPayment({
        id: createId(),
        paymentReference: 'PAY-B',
        orderId,
        orderCode: 'NX1',
        customerId: 'c1',
        provider: 'MOCK',
        method: 'MOCK',
        status: 'PENDING',
        amount: 100,
        currency: 'VND',
        attempt: { attemptNumber: 1, status: 'PENDING' },
        outboxEvents: [],
        actorId: 'test',
      }),
    ).rejects.toMatchObject({ errorCode: 'PAYMENT_ALREADY_EXISTS' });
  });
});
