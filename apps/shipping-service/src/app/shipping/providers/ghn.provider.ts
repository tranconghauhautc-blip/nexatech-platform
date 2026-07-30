import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import type { ShipmentStatus } from '../shipping.types';
import type {
  CreateShipmentProviderInput,
  CreateShipmentProviderResult,
  QuoteProviderInput,
  QuoteProviderResult,
  ShippingProviderAdapter,
} from './shipping-provider';

/**
 * GHN skeleton — không gọi API thật khi thiếu GHN_TOKEN.
 * Production cần credential từ người dùng.
 */
export class GhnShippingProvider implements ShippingProviderAdapter {
  readonly code = 'GHN' as const;

  constructor(
    private readonly baseUrl = process.env['GHN_BASE_URL'],
    private readonly token = process.env['GHN_TOKEN'],
    private readonly shopId = process.env['GHN_SHOP_ID'],
  ) {}

  private assertConfigured(): void {
    if (!this.token || !this.shopId || !this.baseUrl) {
      throw new AppError({
        errorCode: ErrorCodes.SHIPPING_PROVIDER_DISABLED,
        message:
          'GHN chưa được cấu hình (thiếu GHN_TOKEN / GHN_SHOP_ID / GHN_BASE_URL)',
      });
    }
  }

  async quote(input: QuoteProviderInput): Promise<QuoteProviderResult> {
    void input;
    this.assertConfigured();
    throw new AppError({
      errorCode: ErrorCodes.SHIPPING_PROVIDER_DISABLED,
      message:
        'GHN quote adapter chưa được kích hoạt — dùng MOCK hoặc rule-based fallback',
    });
  }

  async createShipment(
    input: CreateShipmentProviderInput,
  ): Promise<CreateShipmentProviderResult> {
    void input;
    this.assertConfigured();
    throw new AppError({
      errorCode: ErrorCodes.SHIPPING_PROVIDER_DISABLED,
      message: 'GHN createShipment adapter chưa được kích hoạt',
    });
  }

  async cancelShipment(providerShipmentRef: string): Promise<void> {
    void providerShipmentRef;
    this.assertConfigured();
    throw new AppError({
      errorCode: ErrorCodes.SHIPPING_PROVIDER_DISABLED,
      message: 'GHN cancelShipment adapter chưa được kích hoạt',
    });
  }

  async getTracking(trackingCode: string): Promise<{
    providerStatus: string;
    normalizedStatus: ShipmentStatus;
    locationText?: string;
    note?: string;
  } | null> {
    void trackingCode;
    this.assertConfigured();
    throw new AppError({
      errorCode: ErrorCodes.SHIPPING_PROVIDER_DISABLED,
      message: 'GHN getTracking adapter chưa được kích hoạt',
    });
  }

  handleWebhook(payload: Record<string, unknown>): {
    shipmentId?: string;
    trackingCode?: string;
    providerStatus: string;
    normalizedStatus: ShipmentStatus;
  } {
    void payload;
    throw new AppError({
      errorCode: ErrorCodes.SHIPPING_PROVIDER_DISABLED,
      message: 'GHN webhook chưa được kích hoạt',
    });
  }

  normalizeStatus(providerStatus: string): ShipmentStatus {
    void providerStatus;
    return 'IN_TRANSIT';
  }

  verifyWebhookSignature(
    payload: Record<string, unknown>,
    signature?: string,
  ): boolean {
    void payload;
    void signature;
    return false;
  }
}
