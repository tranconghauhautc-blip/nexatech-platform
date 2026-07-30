import type { NotificationCategory } from '@nexatech/shared-contracts';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';

export interface NotificationTemplate {
  category: NotificationCategory;
  subject: string;
  title: string;
  body: string;
}

export interface RenderedTemplate {
  category: NotificationCategory;
  subject: string;
  title: string;
  body: string;
}

/**
 * Bảng mẫu thông báo tiếng Việt, khoá theo `templateKey`.
 * Với sự kiện tới từ RabbitMQ, `templateKey` mặc định trùng với `eventType`
 * (ví dụ: `order.created`, `payment.paid`, `support.ticket_created`, ...).
 * Cú pháp `{{tên}}` sẽ được thay bằng giá trị tương ứng trong payload sự kiện.
 */
const TEMPLATES: Record<string, NotificationTemplate> = {
  'user.registered': {
    category: 'IDENTITY',
    subject: 'Chào mừng bạn đến với NexaTech',
    title: 'Chào mừng bạn đến với NexaTech',
    body: 'Cảm ơn bạn đã đăng ký tài khoản tại NexaTech. Hãy xác minh email để bắt đầu mua sắm.',
  },
  'identity.welcome': {
    category: 'IDENTITY',
    subject: 'Chào mừng bạn đến với NexaTech',
    title: 'Chào mừng bạn đến với NexaTech',
    body: 'Cảm ơn bạn đã đăng ký tài khoản tại NexaTech. Hãy xác minh email để bắt đầu mua sắm.',
  },
  'user.email_verified': {
    category: 'IDENTITY',
    subject: 'Email của bạn đã được xác minh',
    title: 'Xác minh email thành công',
    body: 'Email của bạn đã được xác minh thành công. Cảm ơn bạn đã tin tưởng NexaTech.',
  },
  'user.password_reset_requested': {
    category: 'IDENTITY',
    subject: 'Yêu cầu đặt lại mật khẩu',
    title: 'Yêu cầu đặt lại mật khẩu',
    body: 'Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Nếu không phải bạn, vui lòng bỏ qua email này.',
  },
  'order.created': {
    category: 'ORDER',
    subject: 'Đơn hàng {{orderCode}} đã được tạo',
    title: 'Đơn hàng {{orderCode}} đã được tạo',
    body: 'Đơn hàng {{orderCode}} của bạn đã được tạo thành công và đang chờ xác nhận.',
  },
  'order.confirmed': {
    category: 'ORDER',
    subject: 'Đơn hàng {{orderCode}} đã được xác nhận',
    title: 'Đơn hàng {{orderCode}} đã được xác nhận',
    body: 'Đơn hàng {{orderCode}} của bạn đã được xác nhận và đang được chuẩn bị.',
  },
  'order.shipped': {
    category: 'ORDER',
    subject: 'Đơn hàng {{orderCode}} đang được giao',
    title: 'Đơn hàng {{orderCode}} đang được giao',
    body: 'Đơn hàng {{orderCode}} của bạn đã được bàn giao cho đơn vị vận chuyển.',
  },
  'order.delivered': {
    category: 'ORDER',
    subject: 'Đơn hàng {{orderCode}} đã giao thành công',
    title: 'Đơn hàng {{orderCode}} đã giao thành công',
    body: 'Đơn hàng {{orderCode}} đã được giao thành công. Cảm ơn bạn đã mua sắm tại NexaTech.',
  },
  'order.cancelled': {
    category: 'ORDER',
    subject: 'Đơn hàng {{orderCode}} đã bị hủy',
    title: 'Đơn hàng {{orderCode}} đã bị hủy',
    body: 'Đơn hàng {{orderCode}} của bạn đã bị hủy. Lý do: {{reason}}.',
  },
  'payment.paid': {
    category: 'PAYMENT',
    subject: 'Thanh toán đơn hàng {{orderCode}} thành công',
    title: 'Thanh toán thành công',
    body: 'Chúng tôi đã nhận được thanh toán cho đơn hàng {{orderCode}}.',
  },
  'payment.failed': {
    category: 'PAYMENT',
    subject: 'Thanh toán đơn hàng {{orderCode}} thất bại',
    title: 'Thanh toán thất bại',
    body: 'Thanh toán cho đơn hàng {{orderCode}} không thành công. Vui lòng thử lại.',
  },
  'payment.refunded': {
    category: 'PAYMENT',
    subject: 'Hoàn tiền đơn hàng {{orderCode}}',
    title: 'Đơn hàng đã được hoàn tiền',
    body: 'Chúng tôi đã hoàn tiền cho đơn hàng {{orderCode}}.',
  },
  'shipment.out-for-delivery': {
    category: 'SHIPPING',
    subject: 'Kiện hàng đang được giao',
    title: 'Kiện hàng đang được giao',
    body: 'Kiện hàng của đơn {{orderCode}} đang trên đường giao đến bạn.',
  },
  'shipment.delivered': {
    category: 'SHIPPING',
    subject: 'Kiện hàng đã giao thành công',
    title: 'Kiện hàng đã giao thành công',
    body: 'Kiện hàng của đơn {{orderCode}} đã được giao thành công.',
  },
  'shipment.delivery-failed': {
    category: 'SHIPPING',
    subject: 'Giao hàng không thành công',
    title: 'Giao hàng không thành công',
    body: 'Kiện hàng của đơn {{orderCode}} giao không thành công. Lý do: {{reason}}.',
  },
  'review.published': {
    category: 'REVIEW',
    subject: 'Đánh giá của bạn đã được đăng',
    title: 'Đánh giá của bạn đã được đăng',
    body: 'Đánh giá của bạn cho sản phẩm đã được đăng công khai. Cảm ơn bạn đã chia sẻ trải nghiệm.',
  },
  'review.reply.created': {
    category: 'REVIEW',
    subject: 'Người bán đã phản hồi đánh giá của bạn',
    title: 'Người bán đã phản hồi đánh giá của bạn',
    body: 'Người bán đã phản hồi đánh giá của bạn. Hãy vào xem chi tiết phản hồi.',
  },
  'review.rejected': {
    category: 'REVIEW',
    subject: 'Đánh giá của bạn không được duyệt',
    title: 'Đánh giá của bạn không được duyệt',
    body: 'Đánh giá của bạn vi phạm chính sách nội dung và đã bị từ chối. Lý do: {{reason}}.',
  },
  'warranty.claim_approved': {
    category: 'WARRANTY',
    subject: 'Yêu cầu bảo hành đã được chấp nhận',
    title: 'Yêu cầu bảo hành đã được chấp nhận',
    body: 'Yêu cầu bảo hành của bạn đã được chấp nhận và đang được xử lý.',
  },
  'warranty.claim_rejected': {
    category: 'WARRANTY',
    subject: 'Yêu cầu bảo hành bị từ chối',
    title: 'Yêu cầu bảo hành bị từ chối',
    body: 'Yêu cầu bảo hành của bạn đã bị từ chối. Lý do: {{reason}}.',
  },
  'warranty.claim_completed': {
    category: 'WARRANTY',
    subject: 'Yêu cầu bảo hành đã hoàn tất',
    title: 'Yêu cầu bảo hành đã hoàn tất',
    body: 'Yêu cầu bảo hành của bạn đã được xử lý hoàn tất.',
  },
  'warranty.return_approved': {
    category: 'WARRANTY',
    subject: 'Yêu cầu đổi trả đã được chấp nhận',
    title: 'Yêu cầu đổi trả đã được chấp nhận',
    body: 'Yêu cầu đổi trả của bạn đã được chấp nhận và đang được xử lý.',
  },
  'warranty.return_rejected': {
    category: 'WARRANTY',
    subject: 'Yêu cầu đổi trả bị từ chối',
    title: 'Yêu cầu đổi trả bị từ chối',
    body: 'Yêu cầu đổi trả của bạn đã bị từ chối. Lý do: {{reason}}.',
  },
  'warranty.return_completed': {
    category: 'WARRANTY',
    subject: 'Yêu cầu đổi trả đã hoàn tất',
    title: 'Yêu cầu đổi trả đã hoàn tất',
    body: 'Yêu cầu đổi trả của bạn đã được xử lý hoàn tất.',
  },
  'support.ticket_created': {
    category: 'SUPPORT',
    subject: 'Yêu cầu hỗ trợ {{ticketCode}} đã được tạo',
    title: 'Yêu cầu hỗ trợ đã được tạo',
    body: 'Yêu cầu hỗ trợ {{ticketCode}} của bạn đã được tiếp nhận. Chúng tôi sẽ phản hồi sớm nhất.',
  },
  'support.ticket_assigned': {
    category: 'SUPPORT',
    subject: 'Bạn được phân công xử lý một yêu cầu hỗ trợ',
    title: 'Bạn được phân công xử lý yêu cầu hỗ trợ',
    body: 'Bạn vừa được phân công xử lý yêu cầu hỗ trợ có mã {{ticketId}}.',
  },
  'support.ticket_resolved': {
    category: 'SUPPORT',
    subject: 'Yêu cầu hỗ trợ đã được giải quyết',
    title: 'Yêu cầu hỗ trợ đã được giải quyết',
    body: 'Yêu cầu hỗ trợ của bạn đã được giải quyết. Vui lòng kiểm tra và phản hồi nếu cần hỗ trợ thêm.',
  },
  'support.ticket_closed': {
    category: 'SUPPORT',
    subject: 'Yêu cầu hỗ trợ đã đóng',
    title: 'Yêu cầu hỗ trợ đã đóng',
    body: 'Yêu cầu hỗ trợ của bạn đã được đóng. Cảm ơn bạn đã liên hệ với NexaTech.',
  },
  'support.ticket_message_added': {
    category: 'SUPPORT',
    subject: 'Có tin nhắn mới trong yêu cầu hỗ trợ',
    title: 'Có tin nhắn mới trong yêu cầu hỗ trợ',
    body: 'Yêu cầu hỗ trợ của bạn vừa có tin nhắn mới. Hãy vào xem chi tiết.',
  },
  'notification.requested': {
    category: 'SYSTEM',
    subject: '{{title}}',
    title: '{{title}}',
    body: '{{body}}',
  },
};

function interpolate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => {
    const value = data[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

export function hasTemplate(templateKey: string): boolean {
  return Object.prototype.hasOwnProperty.call(TEMPLATES, templateKey);
}

export function getTemplate(templateKey: string): NotificationTemplate {
  const template = TEMPLATES[templateKey];
  if (!template) {
    throw new AppError({
      errorCode: ErrorCodes.NOTIFICATION_TEMPLATE_NOT_FOUND,
      message: `Không tìm thấy mẫu thông báo: ${templateKey}`,
      details: { templateKey },
    });
  }
  return template;
}

export function renderTemplate(
  templateKey: string,
  data: Record<string, unknown> = {},
): RenderedTemplate {
  const template = getTemplate(templateKey);
  return {
    category: template.category,
    subject: interpolate(template.subject, data),
    title: interpolate(template.title, data),
    body: interpolate(template.body, data),
  };
}

export function listTemplateKeys(): string[] {
  return Object.keys(TEMPLATES);
}
