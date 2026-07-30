import { createHmac } from 'node:crypto';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import { createId } from '@nexatech/shared-platform';
import { vndToVnpayAmount, vnpayAmountToVnd } from '../money';
import type {
  PaymentProviderAdapter,
  ProviderCreateResult,
  ProviderVerifyResult,
} from './payment-provider';

function sortAndEncode(params: Record<string, string>): string {
  const keys = Object.keys(params)
    .filter((k) => k !== 'vnp_SecureHash' && k !== 'vnp_SecureHashType')
    .sort();
  return keys
    .map(
      (k) => `${k}=${encodeURIComponent(params[k] ?? '').replace(/%20/g, '+')}`,
    )
    .join('&');
}

export function buildVnpaySignature(
  params: Record<string, string>,
  hashSecret: string,
): string {
  const signData = sortAndEncode(params);
  return createHmac('sha512', hashSecret).update(signData).digest('hex');
}

export function verifyVnpaySignature(
  params: Record<string, string>,
  hashSecret: string,
): boolean {
  const received = params['vnp_SecureHash'];
  if (!received) {
    return false;
  }
  const expected = buildVnpaySignature(params, hashSecret);
  return expected === received;
}

export function sanitizeVnpayPayload(
  params: Record<string, string>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = { ...params };
  delete sanitized['vnp_SecureHash'];
  delete sanitized['vnp_SecureHashType'];
  return sanitized;
}

export class VnpayProvider implements PaymentProviderAdapter {
  readonly code = 'VNPAY' as const;

  constructor(
    private readonly config: {
      tmnCode: string;
      hashSecret: string;
      paymentUrl: string;
      returnUrl: string;
      ipnUrl: string;
    },
  ) {}

  supports(method: string): boolean {
    return method === 'VNPAY';
  }

  async createSession(input: {
    paymentReference: string;
    orderId: string;
    orderCode: string;
    amount: number;
    returnUrl?: string;
  }): Promise<ProviderCreateResult> {
    if (!this.config.tmnCode || !this.config.hashSecret) {
      throw new AppError({
        errorCode: ErrorCodes.PAYMENT_PROVIDER_DISABLED,
        message: 'VNPay chưa được cấu hình',
      });
    }

    const now = new Date();
    const createDate = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0'),
    ].join('');

    const vnpAmount = String(vndToVnpayAmount(input.amount));
    const params: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: this.config.tmnCode,
      vnp_Amount: vnpAmount,
      vnp_CurrCode: 'VND',
      vnp_TxnRef: input.paymentReference,
      vnp_OrderInfo: `Thanh toan don ${input.orderCode}`,
      vnp_OrderType: 'other',
      vnp_Locale: 'vn',
      vnp_ReturnUrl: input.returnUrl ?? this.config.returnUrl,
      vnp_IpAddr: '127.0.0.1',
      vnp_CreateDate: createDate,
      vnp_ExpireDate: createDate,
    };

    params['vnp_SecureHash'] = buildVnpaySignature(
      params,
      this.config.hashSecret,
    );
    const query = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    const checkoutUrl = `${this.config.paymentUrl}?${query}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    return {
      status: 'PROCESSING',
      checkoutUrl,
      expiresAt,
      providerReference: input.paymentReference,
      attemptStatus: 'PROCESSING',
    };
  }

  verifyCallback(params: Record<string, string>): ProviderVerifyResult {
    if (!verifyVnpaySignature(params, this.config.hashSecret)) {
      return {
        success: false,
        failureCode: 'INVALID_SIGNATURE',
        failureMessage: 'Chữ ký VNPay không hợp lệ',
      };
    }

    const responseCode = params['vnp_ResponseCode'];
    const txnStatus = params['vnp_TransactionStatus'];
    const providerTxnId = params['vnp_TransactionNo'];

    if (responseCode === '00' && txnStatus === '00') {
      return { success: true, providerTxnId };
    }

    return {
      success: false,
      providerTxnId,
      failureCode: responseCode ?? 'UNKNOWN',
      failureMessage: `VNPay từ chối giao dịch (${responseCode ?? '?'})`,
    };
  }

  verifyAmount(params: Record<string, string>, expectedVnd: number): boolean {
    const raw = params['vnp_Amount'];
    if (!raw) {
      return false;
    }
    const vnpAmount = Number(raw);
    if (!Number.isInteger(vnpAmount)) {
      return false;
    }
    try {
      return vnpayAmountToVnd(vnpAmount) === expectedVnd;
    } catch {
      return false;
    }
  }

  get ipnUrl(): string {
    return this.config.ipnUrl;
  }
}

export function createDefaultVnpayConfig(): VnpayProvider['config'] & {
  paymentUrl: string;
} {
  return {
    tmnCode: process.env['VNPAY_TMN_CODE'] ?? '',
    hashSecret: process.env['VNPAY_HASH_SECRET'] ?? '',
    paymentUrl:
      process.env['VNPAY_PAYMENT_URL'] ??
      'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
    returnUrl:
      process.env['VNPAY_RETURN_URL'] ??
      process.env['PAYMENT_RETURN_URL'] ??
      'http://localhost:3008/api/v1/vnpay/return',
    ipnUrl:
      process.env['VNPAY_IPN_URL'] ??
      process.env['PAYMENT_IPN_URL'] ??
      'http://localhost:3008/api/v1/vnpay/ipn',
  };
}

/** Test helper — build signed VNPay callback params */
export function buildTestVnpayCallback(
  paymentReference: string,
  amountVnd: number,
  hashSecret: string,
  success = true,
): Record<string, string> {
  const params: Record<string, string> = {
    vnp_Amount: String(vndToVnpayAmount(amountVnd)),
    vnp_BankCode: 'NCB',
    vnp_BankTranNo: createId(),
    vnp_CardType: 'ATM',
    vnp_OrderInfo: 'Test',
    vnp_PayDate: '20260730120000',
    vnp_ResponseCode: success ? '00' : '24',
    vnp_TmnCode: 'TESTTMN',
    vnp_TransactionNo: createId().slice(0, 8),
    vnp_TransactionStatus: success ? '00' : '02',
    vnp_TxnRef: paymentReference,
  };
  params['vnp_SecureHash'] = buildVnpaySignature(params, hashSecret);
  return params;
}
