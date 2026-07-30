import {
  buildTestVnpayCallback,
  buildVnpaySignature,
  verifyVnpaySignature,
  VnpayProvider,
} from './providers/vnpay.provider';
import { vndToVnpayAmount } from './money';

const HASH_SECRET = 'TESTSECRET';

describe('VnpayProvider', () => {
  const provider = new VnpayProvider({
    tmnCode: 'TESTTMN',
    hashSecret: HASH_SECRET,
    paymentUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
    returnUrl: 'http://localhost:3008/api/v1/vnpay/return',
    ipnUrl: 'http://localhost:3008/api/v1/vnpay/ipn',
  });

  it('builds valid signature', () => {
    const params = { vnp_Amount: '1000000', vnp_TxnRef: 'PAY-ABC' };
    const sig = buildVnpaySignature(params, HASH_SECRET);
    expect(
      verifyVnpaySignature({ ...params, vnp_SecureHash: sig }, HASH_SECRET),
    ).toBe(true);
  });

  it('rejects invalid signature', () => {
    const params = buildTestVnpayCallback('PAY-1', 500_000, HASH_SECRET);
    params['vnp_SecureHash'] = 'invalid';
    expect(provider.verifyCallback(params).success).toBe(false);
  });

  it('verifies amount matches VND', () => {
    const params = buildTestVnpayCallback('PAY-2', 500_000, HASH_SECRET);
    expect(provider.verifyAmount(params, 500_000)).toBe(true);
    expect(provider.verifyAmount(params, 600_000)).toBe(false);
  });

  it('converts VND correctly for VNPay amount field', () => {
    expect(vndToVnpayAmount(123_456)).toBe(12_345_600);
  });

  it('createSession returns checkout URL', async () => {
    const result = await provider.createSession({
      paymentReference: 'PAY-TEST',
      orderId: 'ord-1',
      orderCode: 'NX20260730001',
      amount: 1_000_000,
    });
    expect(result.checkoutUrl).toContain('sandbox.vnpayment.vn');
    expect(result.status).toBe('PROCESSING');
  });
});
