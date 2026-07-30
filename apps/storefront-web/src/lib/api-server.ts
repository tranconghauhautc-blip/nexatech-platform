import { ApiClient, type ApiRequestOptions } from '@nexatech/shared-web';
import { type ServiceName, getInternalServiceBaseUrl } from './env';
import { getCartToken, getSession, rolesHeaderValue } from './session';

const API_PREFIX = '/api/v1';
const clientCache = new Map<ServiceName, ApiClient>();

function getServiceClient(service: ServiceName): ApiClient {
  const cached = clientCache.get(service);
  if (cached) {
    return cached;
  }
  const client = new ApiClient({
    baseUrl: getInternalServiceBaseUrl(service),
    timeoutMs: 8000,
  });
  clientCache.set(service, client);
  return client;
}

function withApiPrefix(path: string): string {
  if (path.startsWith('/api/')) {
    return path;
  }
  return `${API_PREFIX}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Gọi trực tiếp một backend service từ Server Component / Route Handler
 * (không qua vòng lặp HTTP `/api/bff/...`). Tự đính kèm `x-user-id` /
 * `x-user-roles` từ session cookie và `x-cart-token` khi gọi cart-service.
 */
export async function serverApiRequest<T = unknown>(
  service: ServiceName,
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const [session, cartToken] = await Promise.all([
    getSession(),
    service === 'cart' ? getCartToken() : Promise.resolve(null),
  ]);

  const headers: Record<string, string> = { ...options.headers };
  if (session) {
    headers['x-user-id'] = session.userId;
    headers['x-user-roles'] = rolesHeaderValue(session.roles);
  }
  if (cartToken) {
    headers['x-cart-token'] = cartToken;
  }

  const client = getServiceClient(service);
  return client.request<T>(withApiPrefix(path), { ...options, headers });
}

export function serverApiClient(service: ServiceName): ApiClient {
  return getServiceClient(service);
}
