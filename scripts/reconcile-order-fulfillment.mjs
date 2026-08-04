#!/usr/bin/env node
/**
 * Đối soát (reconcile) fulfillment cho các đơn hàng bị "kẹt" ở trạng thái
 * DELIVERED nhưng kiện hàng (package) chưa được đồng bộ DELIVERED — ví dụ do
 * lỗi tạm thời khi shipping-service gọi shipping-sync về order-service.
 *
 * Script gọi endpoint admin-only:
 *   POST /api/v1/admin/orders/:orderId/reconcile-fulfillment
 * Endpoint này CHỈ đồng bộ trạng thái kiện hàng sang DELIVERED khi đơn đã ở
 * DELIVERED (không đổi trạng thái đơn), idempotent và có ghi audit log.
 *
 * Cách dùng (local/lab — gọi trực tiếp order-service hoặc qua Kong):
 *   node scripts/reconcile-order-fulfillment.mjs NT-20260804-ABC123
 *   node scripts/reconcile-order-fulfillment.mjs <orderId-uuid> <orderCode> ...
 *
 * Env (tùy chọn):
 *   ORDER_SERVICE_URL    Base URL order-service hoặc Kong.
 *                        Mặc định: http://localhost:8000 (qua Kong).
 *                        Dùng http://localhost:3007 để gọi trực tiếp order-service.
 *   RECONCILE_USER_ID    Giá trị header x-user-id giả lập cho actor Admin.
 *                        Mặc định: "reconcile-script".
 *   RECONCILE_ROLES      Giá trị header x-user-roles giả lập.
 *                        Mặc định: "Staff,Admin".
 *
 * LƯU Ý BẢO MẬT: header x-user-id/x-user-roles chỉ được các service backend
 * tin tưởng trực tiếp trong môi trường local/lab (không qua xác thực JWT thật
 * ở Kong). Trong production, KHÔNG dùng script này — gọi endpoint qua Kong với
 * access token Admin thật, ví dụ:
 *
 *   curl -X POST "https://<kong-domain>/api/v1/admin/orders/<orderId>/reconcile-fulfillment" \
 *     -H "Authorization: Bearer <admin-access-token>"
 */

const ORDER_API =
  process.env.ORDER_SERVICE_URL?.replace(/\/+$/, '') || 'http://localhost:8000';
const USER_ID = process.env.RECONCILE_USER_ID || 'reconcile-script';
const ROLES = process.env.RECONCILE_ROLES || 'Staff,Admin';

async function api(path, options = {}) {
  const res = await fetch(`${ORDER_API}${path}`, {
    ...options,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-user-id': USER_ID,
      'x-user-roles': ROLES,
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const msg =
      typeof body === 'object' && body?.message
        ? body.message
        : text.slice(0, 300);
    throw new Error(
      `${options.method || 'GET'} ${path} → ${res.status}: ${msg}`,
    );
  }
  return body;
}

/** Mã đơn NexaTech có dạng NT-YYYYMMDD-XXXXXX (xem order-code.ts); id còn lại là UUID. */
function looksLikeOrderCode(value) {
  return /^NT-\d{8}-[0-9A-Z]{6}$/.test(value);
}

async function resolveOrderId(codeOrId) {
  if (!looksLikeOrderCode(codeOrId)) {
    return codeOrId;
  }
  const data = await api(
    `/api/v1/admin/orders?orderCode=${encodeURIComponent(codeOrId)}&page=1&pageSize=1`,
  );
  const found = data?.items?.[0];
  if (!found) {
    throw new Error(`Không tìm thấy đơn hàng với mã ${codeOrId}`);
  }
  return found.id;
}

async function reconcileOne(codeOrId) {
  const orderId = await resolveOrderId(codeOrId);
  const before = await api(`/api/v1/admin/orders/${orderId}`);
  const result = await api(
    `/api/v1/admin/orders/${orderId}/reconcile-fulfillment`,
    { method: 'POST' },
  );

  const changedPackages = result.packages
    .filter((pkg) => {
      const prev = before.packages.find((bp) => bp.id === pkg.id);
      return prev && prev.status !== pkg.status;
    })
    .map((pkg) => pkg.packageCode);

  if (before.status !== 'DELIVERED') {
    console.log(
      `[reconcile] ${result.orderCode} (${result.id}): bỏ qua — đơn đang ${before.status}, không phải DELIVERED`,
    );
    return;
  }

  console.log(
    changedPackages.length
      ? `[reconcile] ${result.orderCode} (${result.id}): đã đồng bộ DELIVERED cho kiện hàng ${changedPackages.join(', ')}`
      : `[reconcile] ${result.orderCode} (${result.id}): không có kiện hàng cần đồng bộ (đã idempotent)`,
  );
}

async function main() {
  const targets = process.argv.slice(2);
  if (targets.length === 0) {
    console.error(
      'Cách dùng: node scripts/reconcile-order-fulfillment.mjs <orderId|orderCode> [...]',
    );
    process.exitCode = 1;
    return;
  }

  let hadError = false;
  for (const target of targets) {
    try {
      await reconcileOne(target);
    } catch (err) {
      hadError = true;
      console.error(`[reconcile] FAILED ${target}:`, err.message || err);
    }
  }
  if (hadError) {
    process.exitCode = 1;
  }
}

main();
