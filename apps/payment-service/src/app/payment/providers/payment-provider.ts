import type { PaymentMethod } from '@nexatech/shared-contracts';
import type { PaymentProvider } from '../payment.types';

export interface ProviderCreateResult {
  status: 'CREATED' | 'PENDING' | 'PROCESSING';
  checkoutUrl?: string;
  expiresAt?: Date;
  providerReference?: string;
  attemptStatus: 'CREATED' | 'PENDING' | 'PROCESSING';
}

export interface ProviderVerifyResult {
  success: boolean;
  providerTxnId?: string;
  failureCode?: string;
  failureMessage?: string;
}

export interface PaymentProviderAdapter {
  readonly code: PaymentProvider;
  supports(method: PaymentMethod): boolean;
  createSession(input: {
    paymentId: string;
    paymentReference: string;
    orderId: string;
    orderCode: string;
    amount: number;
    currency: string;
    returnUrl?: string;
  }): Promise<ProviderCreateResult>;
  verifyCallback(payload: Record<string, string>): ProviderVerifyResult;
}

export interface RefundAdapter {
  requestRefund(input: {
    paymentReference: string;
    amount: number;
    currency: string;
    reason: string;
    refundReference: string;
  }): Promise<{ providerRefundId?: string; status: 'PENDING' | 'SUCCEEDED' }>;
}
