import { type ErrorCode, createErrorEnvelope } from '@nexatech/shared-errors';
import { NextResponse } from 'next/server';

function generateTraceId(): string {
  const cryptoObj = (globalThis as { crypto?: Crypto }).crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }
  return `trace-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function jsonError(
  errorCode: ErrorCode,
  message: string,
  status: number,
  details?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json(
    createErrorEnvelope({
      errorCode,
      message,
      details,
      traceId: generateTraceId(),
    }),
    { status },
  );
}
