export const EVENT_EXCHANGE = 'nexatech.events';
export const EVENT_DLX = 'nexatech.events.dlx';

export const EventTypes = {
  USER_REGISTERED: 'user.registered',
  USER_EMAIL_VERIFIED: 'user.email_verified',
  USER_PASSWORD_RESET_REQUESTED: 'user.password_reset_requested',
  CUSTOMER_PROFILE_CREATED: 'customer.profile_created',
  CATALOG_PRODUCT_UPDATED: 'catalog.product_updated',
  CATALOG_PRICE_CHANGED: 'catalog.price_changed',
  INVENTORY_RESERVATION_CREATED: 'inventory.reservation.created',
  INVENTORY_RESERVATION_RELEASED: 'inventory.reservation.released',
  INVENTORY_STOCK_COMMITTED: 'inventory.stock.committed',
  INVENTORY_STOCK_RETURNED: 'inventory.stock.returned',
  INVENTORY_TRANSFER_CREATED: 'inventory.transfer.created',
  INVENTORY_TRANSFER_COMPLETED: 'inventory.transfer.completed',
  INVENTORY_LOW_STOCK_DETECTED: 'inventory.low-stock.detected',
  CART_CREATED: 'cart.created',
  CART_ITEM_ADDED: 'cart.item.added',
  CART_ITEM_UPDATED: 'cart.item.updated',
  CART_ITEM_REMOVED: 'cart.item.removed',
  CART_MERGED: 'cart.merged',
  CART_CONVERTED: 'cart.converted',
  CART_EXPIRED: 'cart.expired',
  ORDER_CREATED: 'order.created',
  ORDER_CONFIRMED: 'order.confirmed',
  ORDER_STATUS_CHANGED: 'order.status.changed',
  ORDER_CANCELLED: 'order.cancelled',
  ORDER_PACKAGE_CREATED: 'order.package.created',
  ORDER_READY_TO_SHIP: 'order.ready-to-ship',
  ORDER_SHIPPED: 'order.shipped',
  ORDER_DELIVERED: 'order.delivered',
  ORDER_RETURN_REQUESTED: 'order.return.requested',
  ORDER_RETURNED: 'order.returned',
  ORDER_FAILED: 'order.failed',
  /** Alias tương thích — đồng nghĩa với order.delivered */
  ORDER_FULFILLED: 'order.fulfilled',
  PAYMENT_INITIATED: 'payment.initiated',
  PAYMENT_CREATED: 'payment.created',
  PAYMENT_PENDING: 'payment.pending',
  PAYMENT_PROCESSING: 'payment.processing',
  PAYMENT_PAID: 'payment.paid',
  PAYMENT_SUCCEEDED: 'payment.succeeded',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_CANCELLED: 'payment.cancelled',
  PAYMENT_EXPIRED: 'payment.expired',
  PAYMENT_REFUND_REQUESTED: 'payment.refund.requested',
  PAYMENT_REFUNDED: 'payment.refunded',
  PAYMENT_PARTIALLY_REFUNDED: 'payment.partially-refunded',
  SHIPPING_QUOTE_CREATED: 'shipping.quote.created',
  SHIPPING_SLOT_RESERVED: 'shipping.slot.reserved',
  SHIPPING_SLOT_RELEASED: 'shipping.slot.released',
  SHIPMENT_CREATED: 'shipment.created',
  SHIPMENT_BOOKED: 'shipment.booked',
  SHIPMENT_READY_FOR_PICKUP: 'shipment.ready-for-pickup',
  SHIPMENT_PICKED_UP: 'shipment.picked-up',
  SHIPMENT_IN_TRANSIT: 'shipment.in-transit',
  SHIPMENT_OUT_FOR_DELIVERY: 'shipment.out-for-delivery',
  SHIPMENT_DELIVERED: 'shipment.delivered',
  SHIPMENT_DELIVERY_FAILED: 'shipment.delivery-failed',
  SHIPMENT_CANCELLED: 'shipment.cancelled',
  SHIPMENT_RETURN_TO_SENDER: 'shipment.return-to-sender',
  SHIPMENT_RETURNED: 'shipment.returned',
  SHIPMENT_TRACKING_UPDATED: 'shipment.tracking.updated',
  REVIEW_CREATED: 'review.created',
  REVIEW_PUBLISHED: 'review.published',
  REVIEW_UPDATED: 'review.updated',
  REVIEW_HIDDEN: 'review.hidden',
  REVIEW_REJECTED: 'review.rejected',
  REVIEW_DELETED: 'review.deleted',
  REVIEW_REPLY_CREATED: 'review.reply.created',
  REVIEW_REPLY_UPDATED: 'review.reply.updated',
  REVIEW_REPLY_DELETED: 'review.reply.deleted',
  REVIEW_REPORT_CREATED: 'review.report.created',
  REVIEW_REPORT_RESOLVED: 'review.report.resolved',
  REVIEW_HELPFUL_ADDED: 'review.helpful.added',
  REVIEW_HELPFUL_REMOVED: 'review.helpful.removed',
  REVIEW_RATING_AGGREGATE_UPDATED: 'review.rating-aggregate.updated',
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

/** Aliases tương thích docs cũ */
export const LegacyEventTypes = {
  INVENTORY_RESERVED: EventTypes.INVENTORY_RESERVATION_CREATED,
  INVENTORY_STOCK_LOW: EventTypes.INVENTORY_LOW_STOCK_DETECTED,
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
  [EventTypes.INVENTORY_RESERVATION_CREATED]: 'inventory.reservation.created',
  [EventTypes.INVENTORY_RESERVATION_RELEASED]: 'inventory.reservation.released',
  [EventTypes.INVENTORY_STOCK_COMMITTED]: 'inventory.stock.committed',
  [EventTypes.INVENTORY_STOCK_RETURNED]: 'inventory.stock.returned',
  [EventTypes.INVENTORY_TRANSFER_CREATED]: 'inventory.transfer.created',
  [EventTypes.INVENTORY_TRANSFER_COMPLETED]: 'inventory.transfer.completed',
  [EventTypes.INVENTORY_LOW_STOCK_DETECTED]: 'inventory.low-stock.detected',
  [EventTypes.CART_CREATED]: 'cart.cart.created',
  [EventTypes.CART_ITEM_ADDED]: 'cart.cart.item.added',
  [EventTypes.CART_ITEM_UPDATED]: 'cart.cart.item.updated',
  [EventTypes.CART_ITEM_REMOVED]: 'cart.cart.item.removed',
  [EventTypes.CART_MERGED]: 'cart.cart.merged',
  [EventTypes.CART_CONVERTED]: 'cart.cart.converted',
  [EventTypes.CART_EXPIRED]: 'cart.cart.expired',
  [EventTypes.ORDER_CREATED]: 'order.order.created',
  [EventTypes.ORDER_CONFIRMED]: 'order.order.confirmed',
  [EventTypes.ORDER_STATUS_CHANGED]: 'order.order.status.changed',
  [EventTypes.ORDER_CANCELLED]: 'order.order.cancelled',
  [EventTypes.ORDER_PACKAGE_CREATED]: 'order.order.package.created',
  [EventTypes.ORDER_READY_TO_SHIP]: 'order.order.ready-to-ship',
  [EventTypes.ORDER_SHIPPED]: 'order.order.shipped',
  [EventTypes.ORDER_DELIVERED]: 'order.order.delivered',
  [EventTypes.ORDER_RETURN_REQUESTED]: 'order.order.return.requested',
  [EventTypes.ORDER_RETURNED]: 'order.order.returned',
  [EventTypes.ORDER_FAILED]: 'order.order.failed',
  [EventTypes.ORDER_FULFILLED]: 'order.order.fulfilled',
  [EventTypes.PAYMENT_INITIATED]: 'payment.payment.initiated',
  [EventTypes.PAYMENT_CREATED]: 'payment.payment.created',
  [EventTypes.PAYMENT_PENDING]: 'payment.payment.pending',
  [EventTypes.PAYMENT_PROCESSING]: 'payment.payment.processing',
  [EventTypes.PAYMENT_PAID]: 'payment.payment.paid',
  [EventTypes.PAYMENT_SUCCEEDED]: 'payment.payment.succeeded',
  [EventTypes.PAYMENT_FAILED]: 'payment.payment.failed',
  [EventTypes.PAYMENT_CANCELLED]: 'payment.payment.cancelled',
  [EventTypes.PAYMENT_EXPIRED]: 'payment.payment.expired',
  [EventTypes.PAYMENT_REFUND_REQUESTED]: 'payment.payment.refund.requested',
  [EventTypes.PAYMENT_REFUNDED]: 'payment.payment.refunded',
  [EventTypes.PAYMENT_PARTIALLY_REFUNDED]: 'payment.payment.partially-refunded',
  [EventTypes.SHIPPING_QUOTE_CREATED]: 'shipping.quote.created',
  [EventTypes.SHIPPING_SLOT_RESERVED]: 'shipping.slot.reserved',
  [EventTypes.SHIPPING_SLOT_RELEASED]: 'shipping.slot.released',
  [EventTypes.SHIPMENT_CREATED]: 'shipping.shipment.created',
  [EventTypes.SHIPMENT_BOOKED]: 'shipping.shipment.booked',
  [EventTypes.SHIPMENT_READY_FOR_PICKUP]: 'shipping.shipment.ready-for-pickup',
  [EventTypes.SHIPMENT_PICKED_UP]: 'shipping.shipment.picked-up',
  [EventTypes.SHIPMENT_IN_TRANSIT]: 'shipping.shipment.in-transit',
  [EventTypes.SHIPMENT_OUT_FOR_DELIVERY]: 'shipping.shipment.out-for-delivery',
  [EventTypes.SHIPMENT_DELIVERED]: 'shipping.shipment.delivered',
  [EventTypes.SHIPMENT_DELIVERY_FAILED]: 'shipping.shipment.delivery-failed',
  [EventTypes.SHIPMENT_CANCELLED]: 'shipping.shipment.cancelled',
  [EventTypes.SHIPMENT_RETURN_TO_SENDER]: 'shipping.shipment.return-to-sender',
  [EventTypes.SHIPMENT_RETURNED]: 'shipping.shipment.returned',
  [EventTypes.SHIPMENT_TRACKING_UPDATED]: 'shipping.shipment.tracking.updated',
  [EventTypes.REVIEW_CREATED]: 'review.review.created',
  [EventTypes.REVIEW_PUBLISHED]: 'review.review.published',
  [EventTypes.REVIEW_UPDATED]: 'review.review.updated',
  [EventTypes.REVIEW_HIDDEN]: 'review.review.hidden',
  [EventTypes.REVIEW_REJECTED]: 'review.review.rejected',
  [EventTypes.REVIEW_DELETED]: 'review.review.deleted',
  [EventTypes.REVIEW_REPLY_CREATED]: 'review.review.reply.created',
  [EventTypes.REVIEW_REPLY_UPDATED]: 'review.review.reply.updated',
  [EventTypes.REVIEW_REPLY_DELETED]: 'review.review.reply.deleted',
  [EventTypes.REVIEW_REPORT_CREATED]: 'review.review.report.created',
  [EventTypes.REVIEW_REPORT_RESOLVED]: 'review.review.report.resolved',
  [EventTypes.REVIEW_HELPFUL_ADDED]: 'review.review.helpful.added',
  [EventTypes.REVIEW_HELPFUL_REMOVED]: 'review.review.helpful.removed',
  [EventTypes.REVIEW_RATING_AGGREGATE_UPDATED]:
    'review.review.rating-aggregate.updated',
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
