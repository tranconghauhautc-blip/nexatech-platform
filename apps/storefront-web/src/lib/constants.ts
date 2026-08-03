export const SITE_NAME = 'NexaTech';
export const SITE_DESCRIPTION =
  'NexaTech — Thiết bị công nghệ chính hãng, giao nhanh toàn quốc, hỗ trợ bảo hành minh bạch.';

export const SORT_OPTIONS = [
  { value: 'relevance', label: 'Liên quan nhất' },
  { value: 'newest', label: 'Mới nhất' },
  { value: 'price_asc', label: 'Giá tăng dần' },
  { value: 'price_desc', label: 'Giá giảm dần' },
  { value: 'name', label: 'Tên A-Z' },
] as const;

export const ACCOUNT_NAV = [
  { href: '/tai-khoan', label: 'Tổng quan' },
  { href: '/tai-khoan/ho-so', label: 'Hồ sơ & địa chỉ' },
  { href: '/tai-khoan/don-hang', label: 'Đơn hàng' },
  { href: '/tai-khoan/thanh-toan', label: 'Thanh toán' },
  { href: '/tai-khoan/yeu-thich', label: 'Yêu thích' },
  { href: '/tai-khoan/so-sanh', label: 'So sánh sản phẩm' },
  { href: '/tai-khoan/da-xem', label: 'Đã xem gần đây' },
  { href: '/tai-khoan/danh-gia', label: 'Đánh giá của tôi' },
  { href: '/tai-khoan/bao-hanh', label: 'Bảo hành & đổi trả' },
  { href: '/tai-khoan/ho-tro', label: 'Hỗ trợ' },
  { href: '/tai-khoan/thong-bao', label: 'Thông báo' },
] as const;

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chờ xử lý',
  AWAITING_PAYMENT: 'Chờ thanh toán',
  CONFIRMED: 'Đã xác nhận',
  PROCESSING: 'Đang xử lý',
  READY_TO_SHIP: 'Sẵn sàng giao',
  SHIPPED: 'Đang giao hàng',
  DELIVERED: 'Đã giao hàng',
  CANCELLED: 'Đã hủy',
  RETURN_REQUESTED: 'Yêu cầu trả hàng',
  RETURNED: 'Đã trả hàng',
  FAILED: 'Thất bại',
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  COD: 'Thanh toán khi nhận hàng (COD)',
  MOCK: 'Thanh toán thử nghiệm (Mock)',
  VNPAY: 'VNPay',
};

export const DELIVERY_METHOD_LABELS: Record<string, string> = {
  STANDARD: 'Giao hàng tiêu chuẩn',
  EXPRESS: 'Giao hàng nhanh',
  STORE_PICKUP: 'Nhận tại cửa hàng',
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  UNPAID: 'Chưa thanh toán',
  PENDING: 'Đang xử lý',
  PAID: 'Đã thanh toán',
  FAILED: 'Thất bại',
  REFUNDED: 'Đã hoàn tiền',
  REFUND_PENDING: 'Đang hoàn tiền',
};

export const SHIPMENT_STATUS_LABELS: Record<string, string> = {
  CREATED: 'Đã tạo',
  QUOTED: 'Đã báo giá',
  BOOKED: 'Đã đặt vận chuyển',
  READY_FOR_PICKUP: 'Sẵn sàng lấy hàng',
  PICKED_UP: 'Đã lấy hàng',
  IN_TRANSIT: 'Đang vận chuyển',
  OUT_FOR_DELIVERY: 'Đang giao',
  DELIVERED: 'Đã giao',
  DELIVERY_FAILED: 'Giao thất bại',
  CANCELLED: 'Đã hủy',
  RETURN_TO_SENDER: 'Hoàn về người gửi',
  RETURNED: 'Đã hoàn trả',
};

export const WARRANTY_CLAIM_STATUS_LABELS: Record<string, string> = {
  SUBMITTED: 'Đã gửi yêu cầu',
  UNDER_REVIEW: 'Đang xem xét',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
  IN_PROGRESS: 'Đang xử lý',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
};

export const RETURN_STATUS_LABELS: Record<string, string> = {
  REQUESTED: 'Đã yêu cầu',
  UNDER_REVIEW: 'Đang xem xét',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
  AWAITING_RETURN: 'Chờ gửi hàng trả',
  RECEIVED: 'Đã nhận hàng trả',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
};

export const SUPPORT_TICKET_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Mới mở',
  IN_PROGRESS: 'Đang xử lý',
  WAITING_CUSTOMER: 'Chờ phản hồi của bạn',
  WAITING_STAFF: 'Chờ nhân viên phản hồi',
  RESOLVED: 'Đã giải quyết',
  CLOSED: 'Đã đóng',
  CANCELLED: 'Đã hủy',
};

export const SUPPORT_CATEGORY_LABELS: Record<string, string> = {
  ORDER: 'Đơn hàng',
  PRODUCT: 'Sản phẩm',
  PAYMENT: 'Thanh toán',
  SHIPPING: 'Vận chuyển',
  WARRANTY: 'Bảo hành',
  ACCOUNT: 'Tài khoản',
  OTHER: 'Khác',
};

export const NOTIFICATION_CATEGORY_LABELS: Record<string, string> = {
  IDENTITY: 'Tài khoản',
  ORDER: 'Đơn hàng',
  PAYMENT: 'Thanh toán',
  SHIPPING: 'Vận chuyển',
  REVIEW: 'Đánh giá',
  WARRANTY: 'Bảo hành',
  SUPPORT: 'Hỗ trợ',
  SYSTEM: 'Hệ thống',
};
