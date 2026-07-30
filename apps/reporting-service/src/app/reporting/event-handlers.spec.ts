import { createEventEnvelope, EventTypes } from '@nexatech/shared-events';
import {
  domainForEventType,
  extractAuditData,
  extractOrderData,
  extractPaymentData,
  extractReviewData,
  extractRevenueAmount,
  extractShipmentData,
  extractSupportTicketData,
  extractWarrantyClaimData,
  extractWarrantyReturnData,
  isRevenueEvent,
  metricKeyForEvent,
} from './event-handlers';

describe('domainForEventType', () => {
  it('maps event type prefixes to domains', () => {
    expect(domainForEventType('order.created')).toBe('ORDER');
    expect(domainForEventType('payment.paid')).toBe('PAYMENT');
    expect(domainForEventType('shipment.delivered')).toBe('SHIPPING');
    expect(domainForEventType('review.published')).toBe('REVIEW');
    expect(domainForEventType('warranty.claim_created')).toBe('WARRANTY');
    expect(domainForEventType('support.ticket_created')).toBe('SUPPORT');
    expect(domainForEventType('audit.recorded')).toBe('AUDIT');
    expect(domainForEventType('cart.created')).toBe('OTHER');
  });
});

describe('metricKeyForEvent', () => {
  it('derives generic metric keys from eventType suffix', () => {
    expect(metricKeyForEvent('order.created', 'ORDER')).toBe('orders_created');
    expect(metricKeyForEvent('payment.paid', 'PAYMENT')).toBe('payments_paid');
    expect(metricKeyForEvent('shipment.delivered', 'SHIPPING')).toBe(
      'shipments_delivered',
    );
    expect(metricKeyForEvent('review.published', 'REVIEW')).toBe(
      'reviews_published',
    );
    expect(metricKeyForEvent('audit.recorded', 'AUDIT')).toBe('audit_recorded');
  });

  it('uses overrides for warranty and support business terms', () => {
    expect(metricKeyForEvent('warranty.claim_completed', 'WARRANTY')).toBe(
      'claims_completed',
    );
    expect(metricKeyForEvent('warranty.return_completed', 'WARRANTY')).toBe(
      'returns_completed',
    );
    expect(metricKeyForEvent('support.ticket_resolved', 'SUPPORT')).toBe(
      'tickets_resolved',
    );
  });
});

describe('isRevenueEvent / extractRevenueAmount', () => {
  it('identifies payment.paid and payment.succeeded as revenue events', () => {
    expect(isRevenueEvent('payment.paid')).toBe(true);
    expect(isRevenueEvent('payment.succeeded')).toBe(true);
    expect(isRevenueEvent('payment.failed')).toBe(false);
  });

  it('extracts revenue amount with flexible key fallback', () => {
    expect(extractRevenueAmount({ amount: 500000 })).toBe(500000);
    expect(extractRevenueAmount({ paidAmount: 250000 })).toBe(250000);
    expect(extractRevenueAmount({ grandTotal: 100000 })).toBe(100000);
    expect(extractRevenueAmount({})).toBe(0);
  });
});

describe('extractOrderData', () => {
  it('extracts full fields for order.created', () => {
    const envelope = createEventEnvelope({
      eventType: EventTypes.ORDER_CREATED,
      producer: 'order-service',
      traceId: 'trace-1',
      payload: {
        orderId: 'order-1',
        orderCode: 'NT-1',
        customerId: 'cust-1',
        status: 'CREATED',
        grandTotal: 1000000,
        totalQuantity: 2,
      },
    });
    const result = extractOrderData(envelope);
    expect(result).toEqual({
      orderId: 'order-1',
      orderCode: 'NT-1',
      customerId: 'cust-1',
      status: 'CREATED',
      grandTotal: 1000000,
      totalQuantity: 2,
    });
  });

  it('resolves toStatus for order.status.changed and derives status for order.shipped', () => {
    const changed = createEventEnvelope({
      eventType: EventTypes.ORDER_STATUS_CHANGED,
      producer: 'order-service',
      traceId: 'trace-2',
      payload: {
        orderId: 'order-1',
        fromStatus: 'CONFIRMED',
        toStatus: 'PROCESSING',
      },
    });
    expect(extractOrderData(changed)?.status).toBe('PROCESSING');

    const shipped = createEventEnvelope({
      eventType: EventTypes.ORDER_SHIPPED,
      producer: 'order-service',
      traceId: 'trace-3',
      payload: { orderId: 'order-1', packageId: 'pkg-1', shipmentId: 'ship-1' },
    });
    expect(extractOrderData(shipped)?.status).toBe('SHIPPED');
  });

  it('returns null when orderId cannot be resolved', () => {
    const envelope = createEventEnvelope({
      eventType: EventTypes.ORDER_CREATED,
      producer: 'order-service',
      traceId: 'trace-4',
      payload: { orderCode: 'NT-1' },
    });
    expect(extractOrderData(envelope)).toBeNull();
  });
});

describe('extractPaymentData', () => {
  it('extracts payment fields', () => {
    const envelope = createEventEnvelope({
      eventType: EventTypes.PAYMENT_PAID,
      producer: 'payment-service',
      traceId: 'trace-1',
      payload: {
        paymentId: 'pay-1',
        orderId: 'order-1',
        status: 'PAID',
        amount: 500000,
        method: 'VNPAY',
        currency: 'VND',
      },
    });
    expect(extractPaymentData(envelope)).toEqual({
      paymentId: 'pay-1',
      orderId: 'order-1',
      status: 'PAID',
      amount: 500000,
      method: 'VNPAY',
      currency: 'VND',
    });
  });

  it('returns null when paymentId is missing', () => {
    const envelope = createEventEnvelope({
      eventType: EventTypes.PAYMENT_PAID,
      producer: 'payment-service',
      traceId: 'trace-2',
      payload: { orderId: 'order-1' },
    });
    expect(extractPaymentData(envelope)).toBeNull();
  });
});

describe('extractShipmentData', () => {
  it('extracts carrierCode from provider fallback', () => {
    const envelope = createEventEnvelope({
      eventType: EventTypes.SHIPMENT_DELIVERED,
      producer: 'shipping-service',
      traceId: 'trace-1',
      payload: {
        shipmentId: 'ship-1',
        orderId: 'order-1',
        status: 'DELIVERED',
        provider: 'MOCK',
        trackingCode: 'TRACK-1',
      },
    });
    const result = extractShipmentData(envelope);
    expect(result?.carrierCode).toBe('MOCK');
    expect(result?.status).toBe('DELIVERED');
  });
});

describe('extractReviewData', () => {
  it('marks deletedAt for review.deleted and derives status', () => {
    const envelope = createEventEnvelope({
      eventType: EventTypes.REVIEW_DELETED,
      producer: 'review-service',
      traceId: 'trace-1',
      payload: { reviewId: 'review-1', productId: 'product-1' },
    });
    const result = extractReviewData(envelope);
    expect(result?.status).toBe('DELETED');
    expect(result?.deletedAt).toBeInstanceOf(Date);
  });

  it('extracts rating and status for review.created', () => {
    const envelope = createEventEnvelope({
      eventType: EventTypes.REVIEW_CREATED,
      producer: 'review-service',
      traceId: 'trace-2',
      payload: {
        reviewId: 'review-2',
        productId: 'product-1',
        rating: 5,
        status: 'PENDING',
      },
    });
    const result = extractReviewData(envelope);
    expect(result?.rating).toBe(5);
    expect(result?.status).toBe('PENDING');
  });
});

describe('extractWarrantyClaimData / extractWarrantyReturnData', () => {
  it('falls back to claimCode when claimId is absent', () => {
    const envelope = createEventEnvelope({
      eventType: EventTypes.WARRANTY_CLAIM_CREATED,
      producer: 'warranty-service',
      traceId: 'trace-1',
      payload: {
        claimCode: 'NT-W-1',
        orderId: 'order-1',
        productId: 'product-1',
      },
    });
    const result = extractWarrantyClaimData(envelope);
    expect(result?.claimId).toBe('NT-W-1');
    expect(result?.status).toBe('SUBMITTED');
  });

  it('resolves claim transition status from to/from fields', () => {
    const envelope = createEventEnvelope({
      eventType: EventTypes.WARRANTY_CLAIM_APPROVED,
      producer: 'warranty-service',
      traceId: 'trace-2',
      payload: {
        claimId: 'claim-1',
        orderId: 'order-1',
        from: 'UNDER_REVIEW',
        to: 'APPROVED',
      },
    });
    expect(extractWarrantyClaimData(envelope)?.status).toBe('APPROVED');
  });

  it('falls back to returnCode when returnId is absent', () => {
    const envelope = createEventEnvelope({
      eventType: EventTypes.WARRANTY_RETURN_REQUESTED,
      producer: 'warranty-service',
      traceId: 'trace-3',
      payload: { returnCode: 'NT-R-1', orderId: 'order-1' },
    });
    const result = extractWarrantyReturnData(envelope);
    expect(result?.returnId).toBe('NT-R-1');
    expect(result?.status).toBe('REQUESTED');
  });
});

describe('extractSupportTicketData', () => {
  it('falls back to ticketCode when ticketId is absent and derives OPEN status', () => {
    const envelope = createEventEnvelope({
      eventType: EventTypes.SUPPORT_TICKET_CREATED,
      producer: 'support-service',
      traceId: 'trace-1',
      payload: {
        ticketCode: 'NT-S-1',
        customerId: 'cust-1',
        category: 'ORDER',
        priority: 'NORMAL',
      },
    });
    const result = extractSupportTicketData(envelope);
    expect(result?.ticketId).toBe('NT-S-1');
    expect(result?.status).toBe('OPEN');
    expect(result?.category).toBe('ORDER');
  });
});

describe('extractAuditData', () => {
  it('extracts action/actorId with resourceId fallback and default serviceName', () => {
    const envelope = createEventEnvelope({
      eventType: EventTypes.AUDIT_RECORDED,
      producer: 'media-service',
      traceId: 'trace-1',
      payload: {
        mediaId: 'media-1',
        action: 'media.confirm',
        actorId: 'staff-1',
      },
    });
    const result = extractAuditData(envelope);
    expect(result.action).toBe('media.confirm');
    expect(result.actorId).toBe('staff-1');
    expect(result.resourceId).toBe('media-1');
    expect(result.serviceName).toBe('media-service');
  });

  it('falls back to eventType as action when payload lacks one', () => {
    const envelope = createEventEnvelope({
      eventType: EventTypes.AUDIT_RECORDED,
      producer: 'catalog-service',
      traceId: 'trace-2',
      payload: {},
    });
    expect(extractAuditData(envelope).action).toBe('audit.recorded');
  });
});
