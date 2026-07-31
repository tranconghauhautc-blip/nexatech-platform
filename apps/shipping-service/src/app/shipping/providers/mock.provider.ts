import { createHmac, createHash } from 'node:crypto';
import { ORDER_SHIPPING_FEE_VND } from '@nexatech/shared-contracts';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import { compareSecrets } from '@nexatech/shared-security-lab';
import type { ShipmentStatus } from '../shipping.types';
import type {
  CreateShipmentProviderInput,
  CreateShipmentProviderResult,
  QuoteProviderInput,
  QuoteProviderResult,
  ShippingProviderAdapter,
} from './shipping-provider';

export function isMockShippingEnabled(): boolean {
  const env = process.env['MOCK_SHIPPING_ENABLED'];
  if (env === 'false' || env === '0') {
    return false;
  }
  if (process.env['NODE_ENV'] === 'production' && env !== 'true') {
    return false;
  }
  return true;
}

function baseFee(method: QuoteProviderInput['deliveryMethod']): number {
  return ORDER_SHIPPING_FEE_VND[method];
}

/** Deterministic fee: base + small hash-based surcharge per package (VND int). */
export function computeMockPackageFee(
  method: QuoteProviderInput['deliveryMethod'],
  packageId: string,
): number {
  const base = baseFee(method);
  if (method === 'STORE_PICKUP') {
    return 0;
  }
  const digest = createHash('sha256').update(packageId).digest();
  const firstByte = digest.length > 0 ? Number(digest[0]) : 0;
  const surcharge = (firstByte % 5) * 1000;
  return base + surcharge;
}

export class MockShippingProvider implements ShippingProviderAdapter {
  readonly code = 'MOCK' as const;

  constructor(private readonly webhookSecret?: string) {}

  assertEnabled(): void {
    if (!isMockShippingEnabled()) {
      throw new AppError({
        errorCode: ErrorCodes.SHIPPING_MOCK_DISABLED,
        message: 'Vận chuyển mock đã bị tắt',
      });
    }
  }

  async quote(input: QuoteProviderInput): Promise<QuoteProviderResult> {
    this.assertEnabled();
    const packageFees = input.packageIds.map((packageId) => ({
      packageId,
      fee: computeMockPackageFee(input.deliveryMethod, packageId),
    }));
    const totalFee = packageFees.reduce((sum, p) => sum + p.fee, 0);
    return { packageFees, totalFee, provider: 'MOCK' };
  }

  async createShipment(
    input: CreateShipmentProviderInput,
  ): Promise<CreateShipmentProviderResult> {
    this.assertEnabled();
    const trackingCode = `MOCK-${input.orderCode}-${input.packageId.slice(0, 8).toUpperCase()}`;
    const days = input.deliveryMethod === 'EXPRESS' ? 1 : 3;
    return {
      providerShipmentRef: `mock-ref-${input.shipmentId}`,
      trackingCode,
      estimatedDeliveryAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    };
  }

  async cancelShipment(providerShipmentRef: string): Promise<void> {
    this.assertEnabled();
    void providerShipmentRef;
  }

  async getTracking(trackingCode: string): Promise<{
    providerStatus: string;
    normalizedStatus: ShipmentStatus;
    locationText?: string;
    note?: string;
  } | null> {
    this.assertEnabled();
    if (!trackingCode.startsWith('MOCK-')) {
      return null;
    }
    return {
      providerStatus: 'in_transit',
      normalizedStatus: 'IN_TRANSIT',
      locationText: 'Hub NexaTech',
      note: 'Mock tracking',
    };
  }

  handleWebhook(payload: Record<string, unknown>): {
    shipmentId?: string;
    trackingCode?: string;
    providerStatus: string;
    normalizedStatus: ShipmentStatus;
  } {
    const providerStatus = String(payload['status'] ?? 'unknown');
    return {
      shipmentId:
        typeof payload['shipmentId'] === 'string'
          ? payload['shipmentId']
          : undefined,
      trackingCode:
        typeof payload['trackingCode'] === 'string'
          ? payload['trackingCode']
          : undefined,
      providerStatus,
      normalizedStatus: this.normalizeStatus(providerStatus),
    };
  }

  normalizeStatus(providerStatus: string): ShipmentStatus {
    const map: Record<string, ShipmentStatus> = {
      created: 'CREATED',
      booked: 'BOOKED',
      picked_up: 'PICKED_UP',
      'picked-up': 'PICKED_UP',
      in_transit: 'IN_TRANSIT',
      'in-transit': 'IN_TRANSIT',
      out_for_delivery: 'OUT_FOR_DELIVERY',
      'out-for-delivery': 'OUT_FOR_DELIVERY',
      delivered: 'DELIVERED',
      delivery_failed: 'DELIVERY_FAILED',
      'delivery-failed': 'DELIVERY_FAILED',
      cancelled: 'CANCELLED',
      return_to_sender: 'RETURN_TO_SENDER',
      'return-to-sender': 'RETURN_TO_SENDER',
      returned: 'RETURNED',
    };
    return map[providerStatus.toLowerCase()] ?? 'IN_TRANSIT';
  }

  verifyWebhookSignature(
    payload: Record<string, unknown>,
    signature?: string,
  ): boolean {
    const secret =
      this.webhookSecret ?? process.env['SHIPPING_WEBHOOK_SECRET'] ?? '';
    if (!secret) {
      return Boolean(
        signature === 'mock-token' || process.env['NODE_ENV'] === 'test',
      );
    }
    if (!signature) {
      return false;
    }
    // SC-66 / A04 — compareSecrets is timing-safe in production; weak in lab
    if (compareSecrets({ provided: signature, expected: secret })) {
      return true;
    }
    const body = JSON.stringify(payload);
    const expected = createHmac('sha256', secret).update(body).digest('hex');
    return (
      compareSecrets({ provided: signature, expected }) ||
      compareSecrets({ provided: signature, expected: `sha256=${expected}` })
    );
  }
}
