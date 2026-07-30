import { AppError, ErrorCodes } from '@nexatech/shared-errors';

export function assertVndInt(amount: number, label = 'Số tiền'): void {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new AppError({
      errorCode: ErrorCodes.VALIDATION_FAILED,
      message: `${label} phải là số nguyên không âm (VND)`,
      details: { amount },
    });
  }
  if (!Number.isSafeInteger(amount)) {
    throw new AppError({
      errorCode: ErrorCodes.VALIDATION_FAILED,
      message: `${label} vượt giới hạn an toàn`,
      details: { amount },
    });
  }
}

export function addVnd(a: number, b: number): number {
  assertVndInt(a);
  assertVndInt(b);
  const result = a + b;
  if (!Number.isSafeInteger(result)) {
    throw new AppError({
      errorCode: ErrorCodes.VALIDATION_FAILED,
      message: 'Tổng phí vận chuyển vượt giới hạn an toàn',
    });
  }
  return result;
}
