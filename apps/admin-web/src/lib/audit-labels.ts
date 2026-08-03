/** Map audit action codes → nhãn tiếng Việt (raw action giữ trong tooltip). */
const ACTION_LABELS: Record<string, string> = {
  created: 'Đã tạo',
  updated: 'Cập nhật',
  deleted: 'Đã xóa',
  status_changed: 'Đổi trạng thái',
  media_unlinked: 'Gỡ media',
  stock_receive: 'Nhập kho',
  'inventory.stock.adjusted': 'Điều chỉnh tồn kho',
  'inventory.warehouse.created': 'Tạo kho',
  'inventory.warehouse.updated': 'Cập nhật kho',
  'inventory.store.created': 'Tạo cửa hàng',
  'inventory.store.updated': 'Cập nhật cửa hàng',
  'payment.create': 'Tạo thanh toán',
  'payment.status_update': 'Cập nhật thanh toán',
  'payment.refund': 'Hoàn tiền',
  'shipping.quote.create': 'Tạo báo giá vận chuyển',
  'shipping.slot.release': 'Giải phóng slot giao',
  'review.create': 'Tạo đánh giá',
  'review.update': 'Cập nhật đánh giá',
  'review.delete': 'Xóa đánh giá',
  'support.ticket.create': 'Tạo ticket',
  'support.ticket.message': 'Tin nhắn ticket',
  'support.ticket.assign': 'Gán ticket',
  'support.ticket.update_priority': 'Đổi ưu tiên ticket',
  'media.confirm': 'Xác nhận media',
  presign: 'Presign upload',
  confirm: 'Xác nhận',
  link: 'Liên kết media',
  cleanup_orphan: 'Dọn media mồ côi',
  'reporting.event.processed': 'Xử lý sự kiện',
  create: 'Tạo mới',
  assign: 'Gán',
  update_priority: 'Đổi ưu tiên',
  hide: 'Ẩn',
  'attach-media': 'Đính kèm media',
  'unlink-media': 'Gỡ media',
  customer_reply: 'Khách phản hồi',
  start: 'Bắt đầu xử lý',
  wait_customer: 'Chờ khách',
  resolve: 'Giải quyết',
  close: 'Đóng',
};

const SEGMENT_LABELS: Record<string, string> = {
  inventory: 'Kho',
  payment: 'Thanh toán',
  shipping: 'Vận chuyển',
  review: 'Đánh giá',
  support: 'Hỗ trợ',
  media: 'Media',
  order: 'Đơn hàng',
  catalog: 'Danh mục',
  product: 'Sản phẩm',
  warehouse: 'Kho hàng',
  store: 'Cửa hàng',
  stock: 'Tồn kho',
  ticket: 'Ticket',
  reporting: 'Báo cáo',
};

function humanizeSegment(segment: string): string {
  if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment];
  return segment.replace(/_/g, ' ');
}

/** Trả nhãn tiếng Việt; fallback format action code. */
export function getAuditActionLabel(action: string): string {
  const trimmed = action.trim();
  if (!trimmed) return '—';
  if (ACTION_LABELS[trimmed]) return ACTION_LABELS[trimmed];

  const last = trimmed.split('.').pop() ?? trimmed;
  if (ACTION_LABELS[last]) return ACTION_LABELS[last];

  if (trimmed.includes('.')) {
    const parts = trimmed.split('.');
    const verb =
      ACTION_LABELS[parts[parts.length - 1] ?? ''] ??
      humanizeSegment(parts[parts.length - 1] ?? '');
    const domain = humanizeSegment(parts[0] ?? '');
    return `${domain}: ${verb}`;
  }

  return humanizeSegment(trimmed);
}
