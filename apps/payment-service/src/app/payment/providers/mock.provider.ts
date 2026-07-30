import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import type {
  PaymentProviderAdapter,
  ProviderCreateResult,
  ProviderVerifyResult,
} from './payment-provider';

export function isMockPaymentEnabled(): boolean {
  const env = process.env['MOCK_PAYMENT_ENABLED'];
  if (env === 'false' || env === '0') {
    return false;
  }
  if (process.env['NODE_ENV'] === 'production' && env !== 'true') {
    return false;
  }
  return true;
}

export class MockProvider implements PaymentProviderAdapter {
  readonly code = 'MOCK' as const;

  constructor(private readonly publicBaseUrl: string) {}

  supports(method: string): boolean {
    return method === 'MOCK';
  }

  assertEnabled(): void {
    if (!isMockPaymentEnabled()) {
      throw new AppError({
        errorCode: ErrorCodes.PAYMENT_MOCK_DISABLED,
        message: 'Thanh toán mock đã bị tắt',
      });
    }
  }

  async createSession(input: {
    paymentId: string;
    paymentReference: string;
    amount: number;
  }): Promise<ProviderCreateResult> {
    this.assertEnabled();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const checkoutUrl = `${this.publicBaseUrl}/api/v1/mock-payments/${input.paymentId}/checkout?ref=${encodeURIComponent(input.paymentReference)}`;
    return {
      status: 'PENDING',
      checkoutUrl,
      expiresAt,
      providerReference: input.paymentReference,
      attemptStatus: 'PENDING',
    };
  }

  verifyCallback(): ProviderVerifyResult {
    return {
      success: false,
      failureCode: 'NOT_SUPPORTED',
      failureMessage: 'Mock dùng endpoint succeed/fail riêng',
    };
  }
}
