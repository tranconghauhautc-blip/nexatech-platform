'use client';

import { formatVnd } from '@nexatech/shared-web';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { bff } from '../../lib/api-browser';
import {
  clearRecentlyViewedLocal,
  getRecentlyViewed,
  type RecentlyViewedEntry,
} from '../../lib/recently-viewed';
import { useAuth } from '../providers/auth-provider';
import { MediaThumb } from '../media/media-thumb';
import styles from './recently-viewed-section.module.css';

interface RemoteRecentlyViewedRow {
  id?: string;
  productId?: string;
  viewedAt?: string;
}

function isActiveStatus(status?: string): boolean {
  if (!status) {
    return false;
  }
  const normalized = status.toLowerCase();
  return normalized === 'active';
}

async function hydrateProductIds(
  productIds: string[],
  viewedAtById: Map<string, string>,
): Promise<{ ok: boolean; items: RecentlyViewedEntry[] }> {
  if (productIds.length === 0) {
    return { ok: true, items: [] };
  }
  let summaries: Array<Record<string, unknown>> = [];
  try {
    const result = await bff.get(
      `/api/bff/catalog/products/summaries?ids=${encodeURIComponent(productIds.join(','))}`,
    );
    summaries = Array.isArray(result)
      ? (result as Array<Record<string, unknown>>)
      : [];
  } catch {
    return { ok: false, items: [] };
  }
  const byId = new Map(summaries.map((s) => [String(s['id']), s]));
  const entries: RecentlyViewedEntry[] = [];
  for (const productId of productIds) {
    const summary = byId.get(productId);
    if (!summary) {
      continue;
    }
    const status = String(summary['status'] ?? '');
    if (!isActiveStatus(status)) {
      continue;
    }
    const slug = String(summary['slug'] ?? '').trim();
    const name = String(summary['name'] ?? '').trim();
    if (!slug || !name) {
      continue;
    }
    entries.push({
      id: productId,
      slug,
      name,
      price:
        typeof summary['minPrice'] === 'number'
          ? (summary['minPrice'] as number)
          : 0,
      thumbnailMediaId: summary['thumbnailUrl']
        ? String(summary['thumbnailUrl'])
        : null,
      brandName: summary['brandName'] ? String(summary['brandName']) : null,
      viewedAt: viewedAtById.get(productId) ?? new Date().toISOString(),
    });
  }
  return { ok: true, items: entries };
}

export function RecentlyViewedSection({ excludeId }: { excludeId?: string }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [items, setItems] = useState<RecentlyViewedEntry[]>([]);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (isAuthenticated) {
      bff
        .get<RemoteRecentlyViewedRow[] | { items?: RemoteRecentlyViewedRow[] }>(
          '/api/bff/cart/recently-viewed',
        )
        .then(async (data) => {
          const list = Array.isArray(data) ? data : (data.items ?? []);
          const productIds = list
            .map((row) => String(row.productId ?? '').trim())
            .filter(Boolean);
          const viewedAtById = new Map(
            list.map((row) => [
              String(row.productId ?? '').trim(),
              row.viewedAt ?? new Date().toISOString(),
            ]),
          );
          const hydrated = await hydrateProductIds(productIds, viewedAtById);
          clearRecentlyViewedLocal();
          setItems(hydrated.items);
        })
        .catch(() => setItems([]));
      return;
    }
    const local = getRecentlyViewed().filter((entry) =>
      Boolean(entry.id && entry.slug && entry.name),
    );
    const productIds = local.map((entry) => entry.id);
    const viewedAtById = new Map(
      local.map((entry) => [entry.id, entry.viewedAt]),
    );
    hydrateProductIds(productIds, viewedAtById)
      .then((hydrated) => {
        // Prefer catalog hydrate (drops archived/missing); fall back to local if catalog unavailable.
        setItems(hydrated.ok ? hydrated.items : local);
      })
      .catch(() => setItems(local));
  }, [authLoading, isAuthenticated, excludeId]);

  const visible = items.filter((item) => item.id !== excludeId);

  if (visible.length === 0) {
    return null;
  }

  return (
    <section className={styles.root}>
      <h2 className="nt-section-title">Sản phẩm đã xem</h2>
      <div className={styles.row}>
        {visible.slice(0, 8).map((item) => (
          <Link
            key={item.id}
            href={`/san-pham/${item.slug}`}
            className={styles.card}
          >
            <MediaThumb
              mediaRef={item.thumbnailMediaId}
              alt={item.name}
              className={styles.image}
              fallbackLabel={item.name}
            />
            <span className={styles.name}>{item.name}</span>
            <span className={styles.price}>{formatVnd(item.price)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
