import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import type { ShipmentStatus } from './shipping.types';

const TRANSITIONS: Record<ShipmentStatus, readonly ShipmentStatus[]> = {
  CREATED: ['QUOTED', 'BOOKED', 'CANCELLED'],
  QUOTED: ['BOOKED', 'CANCELLED'],
  BOOKED: ['READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'CANCELLED'],
  READY_FOR_PICKUP: ['PICKED_UP', 'DELIVERED', 'CANCELLED'],
  PICKED_UP: ['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERY_FAILED'],
  IN_TRANSIT: [
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'DELIVERY_FAILED',
    'RETURN_TO_SENDER',
  ],
  OUT_FOR_DELIVERY: ['DELIVERED', 'DELIVERY_FAILED', 'RETURN_TO_SENDER'],
  DELIVERY_FAILED: ['OUT_FOR_DELIVERY', 'RETURN_TO_SENDER', 'CANCELLED'],
  RETURN_TO_SENDER: ['RETURNED'],
  DELIVERED: [],
  CANCELLED: [],
  RETURNED: [],
};

export const TERMINAL_SHIPMENT_STATUSES: readonly ShipmentStatus[] = [
  'DELIVERED',
  'CANCELLED',
  'RETURNED',
];

export function isTerminalShipmentStatus(status: ShipmentStatus): boolean {
  return TERMINAL_SHIPMENT_STATUSES.includes(status);
}

export function getAllowedShipmentTransitions(
  from: ShipmentStatus,
): readonly ShipmentStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function canShipmentTransition(
  from: ShipmentStatus,
  to: ShipmentStatus,
): boolean {
  return getAllowedShipmentTransitions(from).includes(to);
}

export function assertShipmentTransition(
  from: ShipmentStatus,
  to: ShipmentStatus,
): void {
  if (!canShipmentTransition(from, to)) {
    throw new AppError({
      errorCode: ErrorCodes.SHIPPING_INVALID_TRANSITION,
      message: `Không thể chuyển trạng thái vận chuyển từ ${from} sang ${to}`,
      details: { from, to },
    });
  }
}
