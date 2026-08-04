'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatVnd } from '@nexatech/shared-web';
import { EmptyState } from '../../../components/common/empty-state';
import { MediaThumb } from '../../../components/media/media-thumb';
import { bff, getErrorMessage } from '../../../lib/api-browser';
import { formatVariantAttributes } from '../../../lib/cart-utils';
import type { StockSource } from '../../../lib/types';

interface CompareRow {
  productId: string;
  name?: string;
  slug?: string;
  brandName?: string;
  categoryName?: string;
  categorySlug?: string;
  minPrice?: number;
  status?: string;
  thumbnailUrl?: string;
  skuCode?: string;
  variantLabel?: string;
  stockAvailable?: number | null;
  specs: Record<string, string>;
  missing?: boolean;
}

function isUnavailable(row: CompareRow): boolean {
  return (
    Boolean(row.missing) ||
    row.status === 'archived' ||
    row.status === 'inactive' ||
    row.status === 'draft' ||
    row.status === 'ARCHIVED' ||
    row.status === 'UNPUBLISHED'
  );
}

export default function ComparePage() {
  const [items, setItems] = useState<CompareRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    bff
      .get('/api/bff/cart/comparison')
      .then(async (data) => {
        const list = Array.isArray(data)
          ? data
          : ((data as { items?: unknown[] })?.items ?? []);
        const rows = list as Array<Record<string, unknown>>;
        const productIds = rows
          .map((r) => String(r['productId'] ?? ''))
          .filter(Boolean);
        let summaries: Array<Record<string, unknown>> = [];
        if (productIds.length > 0) {
          try {
            const result = await bff.get(
              `/api/bff/catalog/products/summaries?ids=${encodeURIComponent(productIds.join(','))}`,
            );
            summaries = Array.isArray(result)
              ? (result as Array<Record<string, unknown>>)
              : [];
          } catch {
            summaries = [];
          }
        }
        const byId = new Map(summaries.map((s) => [String(s['id']), s]));

        const hydrated: CompareRow[] = rows.map((r) => {
          const productId = String(r['productId'] ?? '');
          const summary = byId.get(productId);
          const specsRaw = summary?.['specs'];
          const specs =
            specsRaw && typeof specsRaw === 'object'
              ? Object.fromEntries(
                  Object.entries(specsRaw as Record<string, unknown>).map(
                    ([k, v]) => [k, String(v ?? '')],
                  ),
                )
              : {};
          const attrs = summary?.['primarySkuAttributes'];
          const variantLabel =
            attrs && typeof attrs === 'object'
              ? formatVariantAttributes(attrs as Record<string, string>)
              : '';
          return {
            productId,
            name: summary ? String(summary['name'] ?? '') : undefined,
            slug: summary ? String(summary['slug'] ?? '') : undefined,
            brandName: summary ? String(summary['brandName'] ?? '') : undefined,
            categoryName: summary
              ? String(summary['categoryName'] ?? '')
              : undefined,
            categorySlug: summary
              ? String(summary['categorySlug'] ?? '')
              : undefined,
            minPrice:
              typeof summary?.['minPrice'] === 'number'
                ? (summary['minPrice'] as number)
                : undefined,
            status: summary ? String(summary['status'] ?? '') : undefined,
            thumbnailUrl: summary
              ? String(summary['thumbnailUrl'] ?? '')
              : undefined,
            skuCode: summary
              ? String(summary['primarySkuCode'] ?? '')
              : undefined,
            variantLabel: variantLabel || undefined,
            stockAvailable: null,
            specs,
            missing: !summary,
          };
        });

        await Promise.all(
          hydrated.map(async (row, index) => {
            if (!row.skuCode) {
              return;
            }
            try {
              const sources = await bff.get<StockSource[]>(
                '/api/bff/inventory/stock/availability',
                { skuCode: row.skuCode, quantity: 1 },
              );
              const total = Array.isArray(sources)
                ? sources.reduce((sum, s) => sum + (s.available ?? 0), 0)
                : 0;
              hydrated[index] = { ...row, stockAvailable: total };
            } catch {
              hydrated[index] = { ...row, stockAvailable: null };
            }
          }),
        );

        setItems(hydrated);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const specKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const item of items) {
      Object.keys(item.specs).forEach((k) => keys.add(k));
    }
    return [...keys].sort((a, b) => a.localeCompare(b, 'vi'));
  }, [items]);

  async function removeItem(productId: string) {
    if (!productId || busyId) {
      return;
    }
    setBusyId(productId);
    setError(null);
    try {
      await bff.delete(
        `/api/bff/cart/comparison/${encodeURIComponent(productId)}`,
      );
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function clearAll() {
    if (busyId || items.length === 0) {
      return;
    }
    setBusyId('__clear__');
    setError(null);
    try {
      for (const item of items) {
        await bff.delete(
          `/api/bff/cart/comparison/${encodeURIComponent(item.productId)}`,
        );
      }
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div
        className="nt-skeleton"
        style={{ minHeight: 160 }}
        aria-busy="true"
      />
    );
  }
  if (error && items.length === 0) {
    return (
      <EmptyState
        title="Không tải được dữ liệu"
        description={error}
        action={
          <button
            type="button"
            className="nt-btn nt-btn-primary"
            onClick={load}
          >
            Thử lại
          </button>
        }
      />
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState
        title="So sánh sản phẩm"
        description="Chưa có sản phẩm để so sánh. Thêm tối đa 4 sản phẩm từ trang chi tiết."
        action={
          <Link href="/" className="nt-btn nt-btn-primary">
            Về trang chủ
          </Link>
        }
      />
    );
  }

  const cellBorder = {
    padding: 8,
    border: '1px solid #dbeafe',
    verticalAlign: 'top' as const,
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'center',
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 0 }}>So sánh sản phẩm</h2>
        <button
          type="button"
          className="nt-btn nt-btn-ghost"
          disabled={busyId === '__clear__'}
          onClick={() => void clearAll()}
        >
          {busyId === '__clear__' ? 'Đang xóa…' : 'Xóa tất cả'}
        </button>
      </div>
      {error ? (
        <p className="nt-form-error" role="alert">
          {error}
        </p>
      ) : null}
      <p style={{ color: '#4b6478', marginTop: 8 }}>
        Đang so sánh {items.length}/4 sản phẩm.
      </p>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          background: '#fff',
        }}
      >
        <thead>
          <tr>
            <th style={{ ...cellBorder, textAlign: 'left', minWidth: 120 }}>
              Thông số
            </th>
            {items.map((item) => {
              const unavailable = isUnavailable(item);
              return (
                <th
                  key={item.productId}
                  style={{
                    ...cellBorder,
                    textAlign: 'left',
                    minWidth: 180,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <MediaThumb
                      mediaRef={item.thumbnailUrl}
                      alt={item.name ?? 'Sản phẩm'}
                      fallbackLabel={item.name}
                    />
                    <strong>
                      {unavailable
                        ? (item.name ?? 'Không còn kinh doanh')
                        : (item.name ?? 'Sản phẩm')}
                    </strong>
                    {unavailable ? (
                      <span style={{ color: '#b45309', fontWeight: 400 }}>
                        Không còn kinh doanh
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className="nt-btn nt-btn-ghost"
                      disabled={busyId === item.productId}
                      onClick={() => removeItem(item.productId)}
                    >
                      {busyId === item.productId ? 'Đang xóa…' : 'Xóa'}
                    </button>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={cellBorder}>Thương hiệu</td>
            {items.map((item) => (
              <td key={item.productId} style={cellBorder}>
                {item.brandName || '—'}
              </td>
            ))}
          </tr>
          <tr>
            <td style={cellBorder}>Danh mục</td>
            {items.map((item) => (
              <td key={item.productId} style={cellBorder}>
                {item.categoryName || item.categorySlug || '—'}
              </td>
            ))}
          </tr>
          <tr>
            <td style={cellBorder}>SKU / phiên bản</td>
            {items.map((item) => (
              <td key={item.productId} style={cellBorder}>
                {item.skuCode ? (
                  <>
                    <div>{item.skuCode}</div>
                    {item.variantLabel ? (
                      <div style={{ color: '#4b6478', fontSize: '0.9em' }}>
                        {item.variantLabel}
                      </div>
                    ) : null}
                  </>
                ) : (
                  '—'
                )}
              </td>
            ))}
          </tr>
          <tr>
            <td style={cellBorder}>Giá</td>
            {items.map((item) => (
              <td key={item.productId} style={cellBorder}>
                {typeof item.minPrice === 'number'
                  ? formatVnd(item.minPrice)
                  : '—'}
              </td>
            ))}
          </tr>
          <tr>
            <td style={cellBorder}>Tồn kho</td>
            {items.map((item) => (
              <td key={item.productId} style={cellBorder}>
                {item.stockAvailable == null
                  ? '—'
                  : item.stockAvailable > 0
                    ? `Còn hàng · ${item.stockAvailable}`
                    : 'Hết hàng'}
              </td>
            ))}
          </tr>
          {specKeys.map((key) => (
            <tr key={key}>
              <td style={cellBorder}>{key}</td>
              {items.map((item) => (
                <td key={item.productId} style={cellBorder}>
                  {item.specs[key] || '—'}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <td style={cellBorder}>Liên kết</td>
            {items.map((item) => (
              <td key={item.productId} style={cellBorder}>
                {item.slug && !isUnavailable(item) ? (
                  <Link href={`/san-pham/${item.slug}`}>Xem sản phẩm</Link>
                ) : (
                  '—'
                )}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
