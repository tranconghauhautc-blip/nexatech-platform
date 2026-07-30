import type { RefundAdapter } from './payment-provider';

/**
 * Mock refund adapter for development and tests.
 * VNPay production refund API is not wired — requires merchant credentials
 * and separate refund endpoint integration.
 */
export class MockRefundAdapter implements RefundAdapter {
  async requestRefund(input: {
    refundReference: string;
  }): Promise<{ providerRefundId?: string; status: 'PENDING' | 'SUCCEEDED' }> {
    return {
      providerRefundId: `MOCK-RF-${input.refundReference}`,
      status: 'SUCCEEDED',
    };
  }
}

export class VnpayRefundAdapterStub implements RefundAdapter {
  async requestRefund(): Promise<{
    providerRefundId?: string;
    status: 'PENDING' | 'SUCCEEDED';
  }> {
    throw new Error(
      'VNPay refund chưa được tích hợp — dùng MOCK provider hoặc mock-refund adapter',
    );
  }
}
