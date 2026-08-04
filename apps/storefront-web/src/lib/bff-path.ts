/**
 * Build browser BFF URLs: `/api/bff/{service}/{nestPath}`.
 * The first segment selects the microservice; it is NOT re-appended upstream.
 */
export function bffPath(service: string, nestPath: string): string {
  const svc = service.replace(/^\/+|\/+$/g, '');
  const path = nestPath.replace(/^\/+/, '');
  if (!svc) {
    throw new Error('bffPath: service is required');
  }
  return path ? `/api/bff/${svc}/${path}` : `/api/bff/${svc}`;
}

/** Canonical shipping shipment lookup by order id. */
export function shippingShipmentsByOrderPath(orderId: string): string {
  return bffPath('shipping', `shipments/order/${encodeURIComponent(orderId)}`);
}

/** Guest tracking — Nest controller is `@Controller('shipping')`. */
export function shippingTrackingPath(trackingCode: string): string {
  return bffPath(
    'shipping',
    `shipping/tracking/${encodeURIComponent(trackingCode)}`,
  );
}
