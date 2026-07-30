import {
  EVENT_EXCHANGE,
  EventTypes,
  createEventEnvelope,
  routingKeyFor,
} from './shared-events';

describe('shared-events', () => {
  it('creates event envelopes with routing keys', () => {
    const event = createEventEnvelope({
      eventType: EventTypes.ORDER_CREATED,
      producer: 'order-service',
      traceId: 'trace-9',
      payload: { orderId: 'o-1', userId: 'u-1' },
      eventId: 'evt-1',
      occurredAt: '2026-07-29T12:00:00.000Z',
    });

    expect(event).toEqual({
      eventId: 'evt-1',
      eventType: 'order.created',
      occurredAt: '2026-07-29T12:00:00.000Z',
      producer: 'order-service',
      traceId: 'trace-9',
      payload: { orderId: 'o-1', userId: 'u-1' },
    });
    expect(routingKeyFor(EventTypes.ORDER_CREATED)).toBe('order.order.created');
    expect(routingKeyFor(EventTypes.REVIEW_PUBLISHED)).toBe(
      'review.review.published',
    );
    expect(routingKeyFor(EventTypes.REVIEW_RATING_AGGREGATE_UPDATED)).toBe(
      'review.review.rating-aggregate.updated',
    );
    expect(EVENT_EXCHANGE).toBe('nexatech.events');
  });

  it('auto-generates eventId when omitted', () => {
    const event = createEventEnvelope({
      eventType: EventTypes.USER_REGISTERED,
      producer: 'identity-service',
      traceId: 't',
      payload: { userId: 'u' },
    });
    expect(event.eventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});
