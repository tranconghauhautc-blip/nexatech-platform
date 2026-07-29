export const EVENT_EXCHANGE = 'nexatech.events';
export const EVENT_DLX = 'nexatech.events.dlx';

export const EventTypes = {
  USER_REGISTERED: 'user.registered',
  USER_EMAIL_VERIFIED: 'user.email_verified',
  USER_PASSWORD_RESET_REQUESTED: 'user.password_reset_requested',
  CUSTOMER_PROFILE_CREATED: 'customer.profile_created',
  CATALOG_PRODUCT_UPDATED: 'catalog.product_updated',
  CATALOG_PRICE_CHANGED: 'catalog.price_changed',
  INVENTORY_RESERVED: 'inventory.reserved',
  INVENTORY_RESERVATION_RELEASED: 'inventory.reservation_released',
  INVENTORY_STOCK_LOW: 'inventory.stock_low',
  CART_MERGED: 'cart.merged',
  ORDER_CREATED: 'order.created',
  ORDER_CANCELLED: 'order.cancelled',
  ORDER_FULFILLED: 'order.fulfilled',
  PAYMENT_INITIATED: 'payment.initiated',
  PAYMENT_SUCCEEDED: 'payment.succeeded',
  PAYMENT_FAILED: 'payment.failed',
  SHIPMENT_CREATED: 'shipment.created',
  SHIPMENT_IN_TRANSIT: 'shipment.in_transit',
  SHIPMENT_DELIVERED: 'shipment.delivered',
  REVIEW_CREATED: 'review.created',
  WARRANTY_CLAIM_CREATED: 'warranty.claim_created',
  SUPPORT_TICKET_CREATED: 'support.ticket_created',
  SUPPORT_TICKET_UPDATED: 'support.ticket_updated',
  AUDIT_RECORDED: 'audit.recorded',
  MEDIA_UPLOADED: 'media.uploaded',
  MEDIA_DELETED: 'media.deleted',
  CATALOG_CATEGORY_UPDATED: 'catalog.category_updated',
  CATALOG_BRAND_UPDATED: 'catalog.brand_updated',
  NOTIFICATION_REQUESTED: 'notification.requested',
} as const;

export type EventType = (typeof EventTypes)[keyof typeof EventTypes];

export const RoutingKeys: Record<EventType, string> = {
  [EventTypes.USER_REGISTERED]: 'identity.user.registered',
  [EventTypes.USER_EMAIL_VERIFIED]: 'identity.user.email_verified',
  [EventTypes.USER_PASSWORD_RESET_REQUESTED]:
    'identity.user.password_reset_requested',
  [EventTypes.CUSTOMER_PROFILE_CREATED]: 'customer.profile.created',
  [EventTypes.CATALOG_PRODUCT_UPDATED]: 'catalog.product.updated',
  [EventTypes.CATALOG_PRICE_CHANGED]: 'catalog.price.changed',
  [EventTypes.INVENTORY_RESERVED]: 'inventory.stock.reserved',
  [EventTypes.INVENTORY_RESERVATION_RELEASED]: 'inventory.stock.released',
  [EventTypes.INVENTORY_STOCK_LOW]: 'inventory.stock.low',
  [EventTypes.CART_MERGED]: 'cart.cart.merged',
  [EventTypes.ORDER_CREATED]: 'order.order.created',
  [EventTypes.ORDER_CANCELLED]: 'order.order.cancelled',
  [EventTypes.ORDER_FULFILLED]: 'order.order.fulfilled',
  [EventTypes.PAYMENT_INITIATED]: 'payment.payment.initiated',
  [EventTypes.PAYMENT_SUCCEEDED]: 'payment.payment.succeeded',
  [EventTypes.PAYMENT_FAILED]: 'payment.payment.failed',
  [EventTypes.SHIPMENT_CREATED]: 'shipping.shipment.created',
  [EventTypes.SHIPMENT_IN_TRANSIT]: 'shipping.shipment.in_transit',
  [EventTypes.SHIPMENT_DELIVERED]: 'shipping.shipment.delivered',
  [EventTypes.REVIEW_CREATED]: 'review.review.created',
  [EventTypes.WARRANTY_CLAIM_CREATED]: 'warranty.claim.created',
  [EventTypes.SUPPORT_TICKET_CREATED]: 'support.ticket.created',
  [EventTypes.SUPPORT_TICKET_UPDATED]: 'support.ticket.updated',
  [EventTypes.AUDIT_RECORDED]: 'reporting.audit.recorded',
  [EventTypes.MEDIA_UPLOADED]: 'media.media.uploaded',
  [EventTypes.MEDIA_DELETED]: 'media.media.deleted',
  [EventTypes.CATALOG_CATEGORY_UPDATED]: 'catalog.category.updated',
  [EventTypes.CATALOG_BRAND_UPDATED]: 'catalog.brand.updated',
  [EventTypes.NOTIFICATION_REQUESTED]: 'notification.message.requested',
};

export interface EventEnvelope<TPayload = Record<string, unknown>> {
  eventId: string;
  eventType: EventType;
  occurredAt: string;
  producer: string;
  traceId: string;
  payload: TPayload;
}

export function createEventEnvelope<
  TPayload extends Record<string, unknown>,
>(options: {
  eventType: EventType;
  producer: string;
  traceId: string;
  payload: TPayload;
  eventId?: string;
  occurredAt?: string;
}): EventEnvelope<TPayload> {
  return {
    eventId: options.eventId ?? crypto.randomUUID(),
    eventType: options.eventType,
    occurredAt: options.occurredAt ?? new Date().toISOString(),
    producer: options.producer,
    traceId: options.traceId,
    payload: options.payload,
  };
}

export function routingKeyFor(eventType: EventType): string {
  return RoutingKeys[eventType];
}
