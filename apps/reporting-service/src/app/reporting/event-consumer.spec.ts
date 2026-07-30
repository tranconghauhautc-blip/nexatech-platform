import { EventTypes, createEventEnvelope } from '@nexatech/shared-events';
import {
  CONSUMED_EVENT_TYPES,
  EventConsumer,
  REPORTING_QUEUE_NAME,
} from './event-consumer';
import { InMemoryReportingRepository } from './reporting.repository';
import { ReportingService } from './reporting.service';

describe('EventConsumer', () => {
  it('binds a durable queue name and consumes the expected domain event types', () => {
    expect(REPORTING_QUEUE_NAME).toBe('reporting-service.events');
    expect(CONSUMED_EVENT_TYPES).toContain(EventTypes.ORDER_CREATED);
    expect(CONSUMED_EVENT_TYPES).toContain(EventTypes.PAYMENT_PAID);
    expect(CONSUMED_EVENT_TYPES).toContain(EventTypes.SHIPMENT_DELIVERED);
    expect(CONSUMED_EVENT_TYPES).toContain(EventTypes.REVIEW_PUBLISHED);
    expect(CONSUMED_EVENT_TYPES).toContain(EventTypes.WARRANTY_CLAIM_COMPLETED);
    expect(CONSUMED_EVENT_TYPES).toContain(EventTypes.SUPPORT_TICKET_RESOLVED);
    expect(CONSUMED_EVENT_TYPES).toContain(EventTypes.AUDIT_RECORDED);
  });

  it('acks a successfully processed message and nacks without requeue on failure (DLX path)', async () => {
    const repository = new InMemoryReportingRepository();
    const service = new ReportingService(repository);
    const consumer = new EventConsumer(service);

    const ack = jest.fn();
    const nack = jest.fn();
    const channel = { ack, nack } as unknown as {
      ack: jest.Mock;
      nack: jest.Mock;
    };

    const okEnvelope = createEventEnvelope({
      eventType: EventTypes.ORDER_CREATED,
      producer: 'order-service',
      traceId: 'trace-ok',
      payload: {
        orderId: 'ord-1',
        orderCode: 'NT-TEST-1',
        status: 'CREATED',
        grandTotal: 1000,
      },
    });

    const okMsg = {
      content: Buffer.from(JSON.stringify(okEnvelope), 'utf8'),
    };
    await (
      consumer as unknown as {
        handleMessage: (
          ch: typeof channel,
          msg: { content: Buffer },
        ) => Promise<void>;
      }
    ).handleMessage(channel, okMsg);

    expect(ack).toHaveBeenCalledTimes(1);
    expect(nack).not.toHaveBeenCalled();

    const badMsg = {
      content: Buffer.from('{not-json', 'utf8'),
    };
    await (
      consumer as unknown as {
        handleMessage: (
          ch: typeof channel,
          msg: { content: Buffer },
        ) => Promise<void>;
      }
    ).handleMessage(channel, badMsg);

    expect(nack).toHaveBeenCalledWith(badMsg, false, false);
  });

  it('processEvent delegates to ReportingService (unit path without RabbitMQ)', async () => {
    const repository = new InMemoryReportingRepository();
    const service = new ReportingService(repository);
    const consumer = new EventConsumer(service);

    const envelope = createEventEnvelope({
      eventType: EventTypes.PAYMENT_PAID,
      producer: 'payment-service',
      traceId: 'trace-pay',
      payload: {
        paymentId: 'pay-1',
        orderId: 'ord-1',
        status: 'PAID',
        amount: 250000,
      },
    });

    await consumer.processEvent(envelope);
    const listed = await service.listPayments(
      { userId: 'staff-1', roles: ['Staff'] },
      { page: 1, pageSize: 20 },
    );
    expect(listed.items).toHaveLength(1);
    expect(listed.items[0]?.paymentId).toBe('pay-1');
  });
});
