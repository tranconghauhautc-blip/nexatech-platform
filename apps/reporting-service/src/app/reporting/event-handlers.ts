import type { EventEnvelope } from '@nexatech/shared-events';

export type EventDomain =
  | 'ORDER'
  | 'PAYMENT'
  | 'SHIPPING'
  | 'REVIEW'
  | 'WARRANTY'
  | 'SUPPORT'
  | 'AUDIT'
  | 'OTHER';

function pickString(
  payload: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
}

function pickNumber(
  payload: Record<string, unknown>,
  keys: string[],
): number | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.trunc(value);
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return Math.trunc(parsed);
      }
    }
  }
  return undefined;
}

/** Status áp đặt cho các eventType không mang field status trong payload gốc. */
const STATUS_OVERRIDES: Record<string, string> = {
  'order.confirmed': 'CONFIRMED',
  'order.shipped': 'SHIPPED',
  'order.delivered': 'DELIVERED',
  'order.cancelled': 'CANCELLED',
  'order.returned': 'RETURNED',
  'order.failed': 'FAILED',
  'review.published': 'PUBLISHED',
  'review.hidden': 'HIDDEN',
  'review.rejected': 'REJECTED',
  'review.deleted': 'DELETED',
  'warranty.claim_created': 'SUBMITTED',
  'warranty.claim_approved': 'APPROVED',
  'warranty.claim_rejected': 'REJECTED',
  'warranty.claim_completed': 'COMPLETED',
  'warranty.claim_cancelled': 'CANCELLED',
  'warranty.return_requested': 'REQUESTED',
  'warranty.return_approved': 'APPROVED',
  'warranty.return_rejected': 'REJECTED',
  'warranty.return_completed': 'COMPLETED',
  'warranty.return_cancelled': 'CANCELLED',
  'support.ticket_created': 'OPEN',
  'support.ticket_resolved': 'RESOLVED',
  'support.ticket_closed': 'CLOSED',
  'support.ticket_cancelled': 'CANCELLED',
};

function resolveStatus(
  payload: Record<string, unknown>,
  eventType: string,
): string | undefined {
  return (
    pickString(payload, ['status', 'toStatus', 'to']) ??
    STATUS_OVERRIDES[eventType]
  );
}

export function domainForEventType(eventType: string): EventDomain {
  if (eventType.startsWith('order.')) return 'ORDER';
  if (eventType.startsWith('payment.')) return 'PAYMENT';
  if (eventType.startsWith('shipment.') || eventType.startsWith('shipping.'))
    return 'SHIPPING';
  if (eventType.startsWith('review.')) return 'REVIEW';
  if (eventType.startsWith('warranty.')) return 'WARRANTY';
  if (eventType.startsWith('support.')) return 'SUPPORT';
  if (eventType.startsWith('audit.')) return 'AUDIT';
  return 'OTHER';
}

const DOMAIN_METRIC_PREFIX: Record<EventDomain, string> = {
  ORDER: 'orders',
  PAYMENT: 'payments',
  SHIPPING: 'shipments',
  REVIEW: 'reviews',
  WARRANTY: 'warranty',
  SUPPORT: 'tickets',
  AUDIT: 'audit',
  OTHER: 'other',
};

/** Metric key ưu tiên cho một số eventType để khớp thuật ngữ nghiệp vụ (claims/returns/tickets). */
const METRIC_KEY_OVERRIDES: Record<string, string> = {
  'warranty.claim_created': 'claims_created',
  'warranty.claim_updated': 'claims_updated',
  'warranty.claim_approved': 'claims_approved',
  'warranty.claim_rejected': 'claims_rejected',
  'warranty.claim_completed': 'claims_completed',
  'warranty.claim_cancelled': 'claims_cancelled',
  'warranty.return_requested': 'returns_requested',
  'warranty.return_updated': 'returns_updated',
  'warranty.return_approved': 'returns_approved',
  'warranty.return_rejected': 'returns_rejected',
  'warranty.return_completed': 'returns_completed',
  'warranty.return_cancelled': 'returns_cancelled',
  'support.ticket_created': 'tickets_created',
  'support.ticket_updated': 'tickets_updated',
  'support.ticket_assigned': 'tickets_assigned',
  'support.ticket_resolved': 'tickets_resolved',
  'support.ticket_closed': 'tickets_closed',
  'support.ticket_cancelled': 'tickets_cancelled',
  'support.ticket_message_added': 'tickets_message_added',
};

/** Tên metric đếm số sự kiện đã xử lý theo domain (`orders_created`, `payments_paid`, ...). */
export function metricKeyForEvent(
  eventType: string,
  domain: EventDomain,
): string {
  const override = METRIC_KEY_OVERRIDES[eventType];
  if (override) {
    return override;
  }
  const suffix = eventType.split('.').slice(1).join('_').replace(/-/g, '_');
  const prefix = DOMAIN_METRIC_PREFIX[domain];
  return `${prefix}_${suffix}`;
}

export function isRevenueEvent(eventType: string): boolean {
  return eventType === 'payment.paid' || eventType === 'payment.succeeded';
}

export function extractRevenueAmount(payload: Record<string, unknown>): number {
  return pickNumber(payload, ['amount', 'paidAmount', 'grandTotal']) ?? 0;
}

export interface OrderEventData {
  orderId: string;
  orderCode?: string;
  customerId?: string;
  status?: string;
  grandTotal?: number;
  totalQuantity?: number;
}

export function extractOrderData(
  envelope: EventEnvelope,
): OrderEventData | null {
  const payload = (envelope.payload ?? {}) as Record<string, unknown>;
  const orderId = pickString(payload, ['orderId', 'id']);
  if (!orderId) {
    return null;
  }
  return {
    orderId,
    orderCode: pickString(payload, ['orderCode']),
    customerId: pickString(payload, ['customerId']),
    status: resolveStatus(payload, envelope.eventType),
    grandTotal: pickNumber(payload, ['grandTotal']),
    totalQuantity: pickNumber(payload, ['totalQuantity']),
  };
}

export interface PaymentEventData {
  paymentId: string;
  orderId?: string;
  status?: string;
  amount?: number;
  method?: string;
  currency?: string;
}

export function extractPaymentData(
  envelope: EventEnvelope,
): PaymentEventData | null {
  const payload = (envelope.payload ?? {}) as Record<string, unknown>;
  const paymentId = pickString(payload, ['paymentId', 'id']);
  if (!paymentId) {
    return null;
  }
  return {
    paymentId,
    orderId: pickString(payload, ['orderId']),
    status: resolveStatus(payload, envelope.eventType),
    amount: pickNumber(payload, ['amount', 'paidAmount', 'grandTotal']),
    method: pickString(payload, ['method']),
    currency: pickString(payload, ['currency']),
  };
}

export interface ShipmentEventData {
  shipmentId: string;
  orderId?: string;
  status?: string;
  carrierCode?: string;
  trackingCode?: string;
}

export function extractShipmentData(
  envelope: EventEnvelope,
): ShipmentEventData | null {
  const payload = (envelope.payload ?? {}) as Record<string, unknown>;
  const shipmentId = pickString(payload, ['shipmentId', 'id']);
  if (!shipmentId) {
    return null;
  }
  return {
    shipmentId,
    orderId: pickString(payload, ['orderId']),
    status: resolveStatus(payload, envelope.eventType),
    carrierCode: pickString(payload, ['carrierCode', 'provider', 'carrier']),
    trackingCode: pickString(payload, ['trackingCode']),
  };
}

export interface ReviewEventData {
  reviewId: string;
  productId?: string;
  customerId?: string;
  status?: string;
  rating?: number;
  deletedAt?: Date;
}

export function extractReviewData(
  envelope: EventEnvelope,
): ReviewEventData | null {
  const payload = (envelope.payload ?? {}) as Record<string, unknown>;
  const reviewId = pickString(payload, ['reviewId', 'id']);
  if (!reviewId) {
    return null;
  }
  return {
    reviewId,
    productId: pickString(payload, ['productId']),
    customerId: pickString(payload, ['customerId']),
    status: resolveStatus(payload, envelope.eventType),
    rating: pickNumber(payload, ['rating']),
    deletedAt:
      envelope.eventType === 'review.deleted'
        ? new Date(envelope.occurredAt)
        : undefined,
  };
}

export interface WarrantyClaimEventData {
  claimId: string;
  orderId?: string;
  customerId?: string;
  status?: string;
}

export function extractWarrantyClaimData(
  envelope: EventEnvelope,
): WarrantyClaimEventData | null {
  const payload = (envelope.payload ?? {}) as Record<string, unknown>;
  const claimId = pickString(payload, ['claimId', 'claimCode', 'id']);
  if (!claimId) {
    return null;
  }
  return {
    claimId,
    orderId: pickString(payload, ['orderId']),
    customerId: pickString(payload, ['customerId']),
    status: resolveStatus(payload, envelope.eventType),
  };
}

export interface WarrantyReturnEventData {
  returnId: string;
  orderId?: string;
  customerId?: string;
  status?: string;
}

export function extractWarrantyReturnData(
  envelope: EventEnvelope,
): WarrantyReturnEventData | null {
  const payload = (envelope.payload ?? {}) as Record<string, unknown>;
  const returnId = pickString(payload, ['returnId', 'returnCode', 'id']);
  if (!returnId) {
    return null;
  }
  return {
    returnId,
    orderId: pickString(payload, ['orderId']),
    customerId: pickString(payload, ['customerId']),
    status: resolveStatus(payload, envelope.eventType),
  };
}

export interface SupportTicketEventData {
  ticketId: string;
  ticketCode?: string;
  customerId?: string;
  status?: string;
  priority?: string;
  category?: string;
}

export function extractSupportTicketData(
  envelope: EventEnvelope,
): SupportTicketEventData | null {
  const payload = (envelope.payload ?? {}) as Record<string, unknown>;
  const ticketId = pickString(payload, ['ticketId', 'ticketCode', 'id']);
  if (!ticketId) {
    return null;
  }
  return {
    ticketId,
    ticketCode: pickString(payload, ['ticketCode']),
    customerId: pickString(payload, ['customerId']),
    status: resolveStatus(payload, envelope.eventType),
    priority: pickString(payload, ['priority']),
    category: pickString(payload, ['category']),
  };
}

export interface AuditEventData {
  action: string;
  actorId?: string;
  actorRoles?: string[];
  resourceType?: string;
  resourceId?: string;
  serviceName?: string;
  details?: Record<string, unknown>;
}

export function extractAuditData(envelope: EventEnvelope): AuditEventData {
  const payload = (envelope.payload ?? {}) as Record<string, unknown>;
  const action = pickString(payload, ['action']) ?? envelope.eventType;
  const resourceId = pickString(payload, [
    'resourceId',
    'mediaId',
    'orderId',
    'reviewId',
    'claimId',
    'ticketId',
    'storeId',
    'warehouseId',
  ]);
  const rolesValue = payload['actorRoles'];
  const actorRoles = Array.isArray(rolesValue)
    ? rolesValue.filter((r): r is string => typeof r === 'string')
    : undefined;
  return {
    action,
    actorId: pickString(payload, ['actorId', 'userId']),
    actorRoles,
    resourceType: pickString(payload, ['resourceType']),
    resourceId,
    serviceName: pickString(payload, ['serviceName']) ?? envelope.producer,
    details: payload,
  };
}
