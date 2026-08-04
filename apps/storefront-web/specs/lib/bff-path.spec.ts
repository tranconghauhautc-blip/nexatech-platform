import {
  bffPath,
  shippingShipmentsByOrderPath,
  shippingTrackingPath,
} from '../../src/lib/bff-path';

describe('bffPath', () => {
  it('builds /api/bff/{service}/{path} without duplicating service key', () => {
    expect(bffPath('shipping', 'shipments/order/abc')).toBe(
      '/api/bff/shipping/shipments/order/abc',
    );
    expect(bffPath('order', '/orders/xyz')).toBe('/api/bff/order/orders/xyz');
  });

  it('does not produce shipping/shipping/shipments (wrong shipments path)', () => {
    const url = shippingShipmentsByOrderPath('order-1');
    expect(url).toBe('/api/bff/shipping/shipments/order/order-1');
    expect(url).not.toContain('/shipping/shipping/shipments');
    expect(url).not.toContain('by-order');
  });

  it('keeps Nest shipping controller segment for tracking', () => {
    expect(shippingTrackingPath('TRK-1')).toBe(
      '/api/bff/shipping/shipping/tracking/TRK-1',
    );
  });
});
