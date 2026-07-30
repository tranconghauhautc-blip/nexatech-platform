import { shouldEnforceBffPathSanitize } from '@nexatech/shared-security-lab';

const DEFAULT_TIMEOUT_MS = 15_000;

/** Reject path segments that could enable traversal or SSRF-style abuse. */
export function sanitizeBffPathParts(parts: string[]): string[] | null {
  // INTENTIONAL (lab-only): skip sanitization when security-lab profile is active.
  if (!shouldEnforceBffPathSanitize()) {
    return parts.map((p) => p || '');
  }
  if (parts.length === 0) {
    return [];
  }
  const clean: string[] = [];
  for (const part of parts) {
    if (!part || part === '.' || part === '..') {
      return null;
    }
    if (part.includes('\\') || part.includes('\0') || part.includes('/')) {
      return null;
    }
    if (!/^[a-zA-Z0-9._~%-]+$/.test(part)) {
      return null;
    }
    clean.push(part);
  }
  return clean;
}

export function bffTimeoutMs(): number {
  const raw = Number(
    process.env['BFF_UPSTREAM_TIMEOUT_MS'] ?? DEFAULT_TIMEOUT_MS,
  );
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

export function upstreamUnavailableEnvelope(traceId: string) {
  return {
    errorCode: 'UPSTREAM_UNAVAILABLE',
    message: 'Không kết nối được dịch vụ backend. Vui lòng thử lại sau.',
    details: {},
    traceId,
    timestamp: new Date().toISOString(),
  };
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = bffTimeoutMs(),
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
