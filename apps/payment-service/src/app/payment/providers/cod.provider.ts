import type {
  PaymentProviderAdapter,
  ProviderCreateResult,
  ProviderVerifyResult,
} from './payment-provider';

export class CodProvider implements PaymentProviderAdapter {
  readonly code = 'COD' as const;

  supports(method: string): boolean {
    return method === 'COD';
  }

  async createSession(): Promise<ProviderCreateResult> {
    return {
      status: 'PENDING',
      attemptStatus: 'PENDING',
    };
  }

  verifyCallback(): ProviderVerifyResult {
    return {
      success: false,
      failureCode: 'NOT_SUPPORTED',
      failureMessage: 'COD không dùng callback',
    };
  }
}
