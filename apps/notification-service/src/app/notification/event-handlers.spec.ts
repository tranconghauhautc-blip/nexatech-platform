import { createEventEnvelope, EventTypes } from '@nexatech/shared-events';
import { extractNotification } from './event-handlers';

describe('extractNotification', () => {
  it('extracts userId and renders template for order.created', () => {
    const envelope = createEventEnvelope({
      eventType: EventTypes.ORDER_CREATED,
      producer: 'order-service',
      traceId: 'trace-1',
      payload: { customerId: 'cust-1', orderCode: 'NT-1' },
    });
    const result = extractNotification(envelope);
    expect(result).not.toBeNull();
    expect(result?.userId).toBe('cust-1');
    expect(result?.email).toBeUndefined();
    expect(result?.category).toBe('ORDER');
    expect(result?.title).toContain('NT-1');
  });

  it('falls back to userId field when customerId is absent', () => {
    const envelope = createEventEnvelope({
      eventType: EventTypes.USER_REGISTERED,
      producer: 'identity-service',
      traceId: 'trace-2',
      payload: { userId: 'user-1', email: 'user@example.com' },
    });
    const result = extractNotification(envelope);
    expect(result?.userId).toBe('user-1');
    expect(result?.email).toBe('user@example.com');
  });

  it('resolves assigneeId as userId for support.ticket_assigned', () => {
    const envelope = createEventEnvelope({
      eventType: EventTypes.SUPPORT_TICKET_ASSIGNED,
      producer: 'support-service',
      traceId: 'trace-3',
      payload: { ticketId: 'ticket-1', assigneeId: 'staff-1' },
    });
    const result = extractNotification(envelope);
    expect(result?.userId).toBe('staff-1');
  });

  it('extracts email from customerEmail / toEmail fallbacks', () => {
    const envelopeA = createEventEnvelope({
      eventType: EventTypes.PAYMENT_PAID,
      producer: 'payment-service',
      traceId: 'trace-4',
      payload: { customerEmail: 'a@example.com', orderCode: 'NT-2' },
    });
    expect(extractNotification(envelopeA)?.email).toBe('a@example.com');

    const envelopeB = createEventEnvelope({
      eventType: EventTypes.PAYMENT_PAID,
      producer: 'payment-service',
      traceId: 'trace-5',
      payload: { toEmail: 'b@example.com', orderCode: 'NT-3' },
    });
    expect(extractNotification(envelopeB)?.email).toBe('b@example.com');
  });

  it('overrides category from payload for notification.requested events', () => {
    const envelope = createEventEnvelope({
      eventType: EventTypes.NOTIFICATION_REQUESTED,
      producer: 'notification-service',
      traceId: 'trace-6',
      payload: {
        userId: 'user-9',
        category: 'WARRANTY',
        title: 'Tiêu đề',
        body: 'Nội dung',
      },
    });
    const result = extractNotification(envelope);
    expect(result?.category).toBe('WARRANTY');
    expect(result?.title).toBe('Tiêu đề');
    expect(result?.body).toBe('Nội dung');
  });

  it('returns null when there is no matching template', () => {
    const envelope = createEventEnvelope({
      eventType: EventTypes.CART_CREATED,
      producer: 'cart-service',
      traceId: 'trace-7',
      payload: { customerId: 'cust-1' },
    });
    expect(extractNotification(envelope)).toBeNull();
  });

  it('routes staff reply to customer and customer reply to assignee', () => {
    const staffReply = createEventEnvelope({
      eventType: EventTypes.SUPPORT_TICKET_MESSAGE_ADDED,
      producer: 'support-service',
      traceId: 'trace-9',
      payload: {
        ticketId: 'ticket-1',
        customerId: 'cust-1',
        assigneeId: 'staff-1',
        authorType: 'STAFF',
      },
    });
    expect(extractNotification(staffReply)?.userId).toBe('cust-1');

    const customerReply = createEventEnvelope({
      eventType: EventTypes.SUPPORT_TICKET_MESSAGE_ADDED,
      producer: 'support-service',
      traceId: 'trace-10',
      payload: {
        ticketId: 'ticket-1',
        customerId: 'cust-1',
        assigneeId: 'staff-1',
        authorType: 'CUSTOMER',
      },
    });
    expect(extractNotification(customerReply)?.userId).toBe('staff-1');
  });

  it('returns null when neither userId nor email can be resolved', () => {
    const envelope = createEventEnvelope({
      eventType: EventTypes.SUPPORT_TICKET_MESSAGE_ADDED,
      producer: 'support-service',
      traceId: 'trace-8',
      payload: { ticketId: 'ticket-1', authorType: 'CUSTOMER' },
    });
    expect(extractNotification(envelope)).toBeNull();
  });
});
