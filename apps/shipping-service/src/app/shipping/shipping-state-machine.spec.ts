import {
  canShipmentTransition,
  assertShipmentTransition,
} from './shipping-state-machine';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';

describe('shipping state machine', () => {
  it('allows CREATED → BOOKED → IN_TRANSIT → DELIVERED', () => {
    expect(canShipmentTransition('CREATED', 'BOOKED')).toBe(true);
    expect(canShipmentTransition('BOOKED', 'IN_TRANSIT')).toBe(true);
    expect(canShipmentTransition('IN_TRANSIT', 'DELIVERED')).toBe(true);
  });

  it('rejects DELIVERED → CANCELLED', () => {
    expect(canShipmentTransition('DELIVERED', 'CANCELLED')).toBe(false);
    expect(() => assertShipmentTransition('DELIVERED', 'CANCELLED')).toThrow(
      AppError,
    );
    try {
      assertShipmentTransition('DELIVERED', 'CANCELLED');
    } catch (error) {
      expect((error as AppError).errorCode).toBe(
        ErrorCodes.SHIPPING_INVALID_TRANSITION,
      );
    }
  });

  it('allows STORE_PICKUP path BOOKED → READY_FOR_PICKUP → PICKED_UP', () => {
    expect(canShipmentTransition('BOOKED', 'READY_FOR_PICKUP')).toBe(true);
    expect(canShipmentTransition('READY_FOR_PICKUP', 'PICKED_UP')).toBe(true);
  });
});
