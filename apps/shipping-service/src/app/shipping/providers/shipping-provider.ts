import type {
  DeliveryMethod,
  ShipmentStatus,
  ShippingProviderCode,
} from '../shipping.types';

export interface QuoteProviderInput {
  orderId: string;
  orderCode: string;
  deliveryMethod: DeliveryMethod;
  packageIds: string[];
  city?: string;
}

export interface QuoteProviderResult {
  packageFees: Array<{ packageId: string; fee: number }>;
  totalFee: number;
  provider: ShippingProviderCode;
}

export interface CreateShipmentProviderInput {
  shipmentId: string;
  orderCode: string;
  packageId: string;
  deliveryMethod: DeliveryMethod;
  destination?: Record<string, unknown>;
  shippingFee: number;
}

export interface CreateShipmentProviderResult {
  providerShipmentRef: string;
  trackingCode: string;
  estimatedDeliveryAt?: Date;
}

export interface ShippingProviderAdapter {
  readonly code: ShippingProviderCode;
  quote(input: QuoteProviderInput): Promise<QuoteProviderResult>;
  createShipment(
    input: CreateShipmentProviderInput,
  ): Promise<CreateShipmentProviderResult>;
  cancelShipment(providerShipmentRef: string): Promise<void>;
  getTracking(trackingCode: string): Promise<{
    providerStatus: string;
    normalizedStatus: ShipmentStatus;
    locationText?: string;
    note?: string;
  } | null>;
  handleWebhook(payload: Record<string, unknown>): {
    shipmentId?: string;
    trackingCode?: string;
    providerStatus: string;
    normalizedStatus: ShipmentStatus;
  };
  normalizeStatus(providerStatus: string): ShipmentStatus;
  verifyWebhookSignature(
    payload: Record<string, unknown>,
    signature?: string,
  ): boolean;
}
