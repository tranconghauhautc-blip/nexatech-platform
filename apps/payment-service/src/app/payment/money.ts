import { AppError, ErrorCodes } from '@nexatech/shared-errors';

const MAX_VND = Number.MAX_SAFE_INTEGER;
const MAX_VNPAY_AMOUNT = Math.floor(MAX_VND / 100);

/** VNPay expects amount in smallest unit: VND × 100 (no decimals). */
export function vndToVnpayAmount(vnd: number): number {
  if (!Number.isInteger(vnd) || vnd <= 0) {
    throw new AppError({
      errorCode: ErrorCodes.VALIDATION_FAILED,
      message: 'Số tiền VND phải là số nguyên dương',
    });
  }
  if (vnd > MAX_VNPAY_AMOUNT) {
    throw new AppError({
      errorCode: ErrorCodes.VALIDATION_FAILED,
      message: 'Số tiền vượt giới hạn cho phép',
    });
  }
  const result = vnd * 100;
  if (!Number.isSafeInteger(result)) {
    throw new AppError({
      errorCode: ErrorCodes.VALIDATION_FAILED,
      message: 'Số tiền vượt giới hạn an toàn',
    });
  }
  return result;
}

export function vnpayAmountToVnd(vnpayAmount: number): number {
  if (!Number.isInteger(vnpayAmount) || vnpayAmount <= 0) {
    throw new AppError({
      errorCode: ErrorCodes.VALIDATION_FAILED,
      message: 'Số tiền VNPay không hợp lệ',
    });
  }
  if (vnpayAmount % 100 !== 0) {
    throw new AppError({
      errorCode: ErrorCodes.PAYMENT_AMOUNT_MISMATCH,
      message: 'Số tiền VNPay phải chia hết cho 100',
    });
  }
  return vnpayAmount / 100;
}

export function addVnd(a: number, b: number): number {
  if (!Number.isInteger(a) || !Number.isInteger(b)) {
    throw new AppError({
      errorCode: ErrorCodes.VALIDATION_FAILED,
      message: 'Số tiền phải là số nguyên',
    });
  }
  const result = a + b;
  if (!Number.isSafeInteger(result)) {
    throw new AppError({
      errorCode: ErrorCodes.VALIDATION_FAILED,
      message: 'Tổng số tiền vượt giới hạn an toàn',
    });
  }
  return result;
}

export function subtractVnd(a: number, b: number): number {
  const result = addVnd(a, -b);
  if (result < 0) {
    throw new AppError({
      errorCode: ErrorCodes.PAYMENT_REFUND_EXCEEDS_PAID,
      message: 'Số tiền hoàn vượt quá số đã thanh toán',
    });
  }
  return result;
}

export function assertRefundAmount(
  paidAmount: number,
  alreadyRefunded: number,
  refundAmount: number,
): void {
  if (!Number.isInteger(refundAmount) || refundAmount <= 0) {
    throw new AppError({
      errorCode: ErrorCodes.VALIDATION_FAILED,
      message: 'Số tiền hoàn phải là số nguyên dương',
    });
  }
  const remaining = subtractVnd(paidAmount, alreadyRefunded);
  if (refundAmount > remaining) {
    throw new AppError({
      errorCode: ErrorCodes.PAYMENT_REFUND_EXCEEDS_PAID,
      message: 'Số tiền hoàn vượt quá số còn lại có thể hoàn',
      details: { paidAmount, alreadyRefunded, refundAmount, remaining },
    });
  }
}
