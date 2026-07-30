import type { NextRequest } from 'next/server';
import { proxyAdminRequest } from '../../../../../lib/bff-proxy';

interface RouteContext {
  params: Promise<{ service: string; path: string[] }>;
}

async function handle(request: NextRequest, context: RouteContext) {
  const { service, path } = await context.params;
  return proxyAdminRequest(request, { service, path });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
