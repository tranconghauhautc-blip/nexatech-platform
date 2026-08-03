import { formatVietnamAddress } from '@nexatech/shared-address';
import { serverApiRequest } from './api-server';

type FetchResult<T> = { ok: true; data: T } | { ok: false; error: true };

async function safeFetch<T>(fn: () => Promise<T>): Promise<FetchResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch {
    return { ok: false, error: true };
  }
}

function extractList(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    return data;
  }
  if (
    data &&
    typeof data === 'object' &&
    Array.isArray((data as { items?: unknown[] }).items)
  ) {
    return (data as { items: unknown[] }).items;
  }
  return [];
}

function extractTotal(data: unknown): number | null {
  if (Array.isArray(data)) {
    return data.length;
  }
  if (data && typeof data === 'object') {
    const record = data as {
      meta?: { totalItems?: number };
      totalItems?: number;
      total?: number;
    };
    if (typeof record.meta?.totalItems === 'number') {
      return record.meta.totalItems;
    }
    if (typeof record.totalItems === 'number') {
      return record.totalItems;
    }
    if (typeof record.total === 'number') {
      return record.total;
    }
    const items = extractList(data);
    return items.length;
  }
  return null;
}

const ORDER_ACTION_STATUSES = new Set([
  'PENDING',
  'AWAITING_PAYMENT',
  'CONFIRMED',
  'PROCESSING',
  'READY_TO_SHIP',
  'RETURN_REQUESTED',
]);

const OPEN_TICKET_STATUSES = new Set([
  'OPEN',
  'IN_PROGRESS',
  'WAITING_CUSTOMER',
  'WAITING_STAFF',
]);

const ACTIVE_CLAIM_STATUSES = new Set([
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'IN_PROGRESS',
]);

const ACTIVE_RETURN_STATUSES = new Set([
  'REQUESTED',
  'UNDER_REVIEW',
  'APPROVED',
  'AWAITING_RETURN',
  'RECEIVED',
]);

const PENDING_PAYMENT_STATUSES = new Set(['PENDING', 'UNPAID']);

export interface AccountOverviewData {
  profile: {
    fullName: string | null;
    phone: string | null;
    error: boolean;
  };
  defaultAddress: {
    summary: string | null;
    error: boolean;
  };
  orders: {
    total: number | null;
    needingAction: number | null;
    error: boolean;
  };
  payments: {
    total: number | null;
    pending: number | null;
    error: boolean;
  };
  wishlist: { count: number | null; error: boolean };
  compare: { count: number | null; error: boolean };
  recentlyViewed: { count: number | null; error: boolean };
  notifications: { unread: number | null; error: boolean };
  support: { open: number | null; error: boolean };
  warrantyReturns: { active: number | null; error: boolean };
}

export async function loadAccountOverview(): Promise<AccountOverviewData> {
  const [
    profileResult,
    addressesResult,
    ordersResult,
    paymentsResult,
    wishlistResult,
    compareResult,
    recentlyViewedResult,
    notificationsResult,
    supportResult,
    claimsResult,
    returnsResult,
  ] = await Promise.all([
    safeFetch(() =>
      serverApiRequest<Record<string, unknown>>('customer', '/customers/me'),
    ),
    safeFetch(() =>
      serverApiRequest<unknown>('customer', '/customers/me/addresses'),
    ),
    safeFetch(() => serverApiRequest<unknown>('order', '/orders')),
    safeFetch(() => serverApiRequest<unknown>('payment', '/payments/me')),
    safeFetch(() => serverApiRequest<unknown>('cart', '/wishlist')),
    safeFetch(() => serverApiRequest<unknown>('cart', '/comparison')),
    safeFetch(() => serverApiRequest<unknown>('cart', '/recently-viewed')),
    safeFetch(() =>
      serverApiRequest<{ count?: number }>(
        'notification',
        '/notifications/unread-count',
      ),
    ),
    safeFetch(() => serverApiRequest<unknown>('support', '/support/tickets')),
    safeFetch(() => serverApiRequest<unknown>('warranty', '/warranty/claims')),
    safeFetch(() => serverApiRequest<unknown>('warranty', '/returns')),
  ]);

  const profile = profileResult.ok
    ? {
        fullName:
          typeof profileResult.data.fullName === 'string'
            ? profileResult.data.fullName
            : null,
        phone:
          typeof profileResult.data.phone === 'string'
            ? profileResult.data.phone
            : null,
        error: false,
      }
    : { fullName: null, phone: null, error: true };

  let defaultAddressSummary: string | null = null;
  if (addressesResult.ok) {
    const addresses = extractList(addressesResult.data) as Array<
      Record<string, unknown>
    >;
    const defaultAddr =
      addresses.find((a) => a.isDefault === true) ?? addresses[0];
    if (defaultAddr) {
      defaultAddressSummary =
        typeof defaultAddr.displayAddress === 'string'
          ? defaultAddr.displayAddress
          : formatVietnamAddress({
              addressLine1: String(defaultAddr.line1 ?? ''),
              wardName:
                typeof defaultAddr.wardName === 'string'
                  ? defaultAddr.wardName
                  : typeof defaultAddr.ward === 'string'
                    ? defaultAddr.ward
                    : null,
              provinceName:
                typeof defaultAddr.provinceName === 'string'
                  ? defaultAddr.provinceName
                  : typeof defaultAddr.city === 'string'
                    ? defaultAddr.city
                    : null,
              legacyDistrictName:
                typeof defaultAddr.legacyDistrictName === 'string'
                  ? defaultAddr.legacyDistrictName
                  : typeof defaultAddr.district === 'string'
                    ? defaultAddr.district
                    : null,
            });
    }
  }

  let ordersTotal: number | null = null;
  let ordersNeedingAction: number | null = null;
  if (ordersResult.ok) {
    ordersTotal = extractTotal(ordersResult.data);
    const orderItems = extractList(ordersResult.data) as Array<
      Record<string, unknown>
    >;
    ordersNeedingAction = orderItems.filter((order) =>
      ORDER_ACTION_STATUSES.has(String(order.status ?? '')),
    ).length;
  }

  let paymentsTotal: number | null = null;
  let paymentsPending: number | null = null;
  if (paymentsResult.ok) {
    const paymentItems = extractList(paymentsResult.data) as Array<
      Record<string, unknown>
    >;
    paymentsTotal = paymentItems.length;
    paymentsPending = paymentItems.filter((payment) =>
      PENDING_PAYMENT_STATUSES.has(String(payment.status ?? '')),
    ).length;
  }

  const wishlistCount = wishlistResult.ok
    ? extractList(wishlistResult.data).length
    : null;
  const compareCount = compareResult.ok
    ? extractList(compareResult.data).length
    : null;
  const recentlyViewedCount = recentlyViewedResult.ok
    ? extractList(recentlyViewedResult.data).length
    : null;

  const unreadCount =
    notificationsResult.ok && typeof notificationsResult.data.count === 'number'
      ? notificationsResult.data.count
      : notificationsResult.ok
        ? 0
        : null;

  let supportOpen: number | null = null;
  if (supportResult.ok) {
    const tickets = extractList(supportResult.data) as Array<
      Record<string, unknown>
    >;
    supportOpen = tickets.filter((ticket) =>
      OPEN_TICKET_STATUSES.has(String(ticket.status ?? '')),
    ).length;
  }

  let warrantyReturnsActive: number | null = null;
  const warrantyErrors = !claimsResult.ok && !returnsResult.ok;
  if (!warrantyErrors) {
    let active = 0;
    if (claimsResult.ok) {
      const claims = extractList(claimsResult.data) as Array<
        Record<string, unknown>
      >;
      active += claims.filter((claim) =>
        ACTIVE_CLAIM_STATUSES.has(String(claim.status ?? '')),
      ).length;
    }
    if (returnsResult.ok) {
      const returns = extractList(returnsResult.data) as Array<
        Record<string, unknown>
      >;
      active += returns.filter((item) =>
        ACTIVE_RETURN_STATUSES.has(String(item.status ?? '')),
      ).length;
    }
    warrantyReturnsActive = active;
  }

  return {
    profile,
    defaultAddress: {
      summary: defaultAddressSummary,
      error: addressesResult.ok ? false : true,
    },
    orders: {
      total: ordersTotal,
      needingAction: ordersNeedingAction,
      error: !ordersResult.ok,
    },
    payments: {
      total: paymentsTotal,
      pending: paymentsPending,
      error: !paymentsResult.ok,
    },
    wishlist: {
      count: wishlistCount,
      error: !wishlistResult.ok,
    },
    compare: {
      count: compareCount,
      error: !compareResult.ok,
    },
    recentlyViewed: {
      count: recentlyViewedCount,
      error: !recentlyViewedResult.ok,
    },
    notifications: {
      unread: unreadCount,
      error: !notificationsResult.ok,
    },
    support: {
      open: supportOpen,
      error: !supportResult.ok,
    },
    warrantyReturns: {
      active: warrantyReturnsActive,
      error: warrantyErrors,
    },
  };
}
