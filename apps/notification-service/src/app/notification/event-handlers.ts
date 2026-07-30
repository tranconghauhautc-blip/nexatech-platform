import {
  NotificationCategories,
  type NotificationCategory,
} from '@nexatech/shared-contracts';
import type { EventEnvelope } from '@nexatech/shared-events';
import { hasTemplate, renderTemplate } from './templates';

export interface ExtractedNotification {
  userId?: string;
  email?: string;
  templateKey: string;
  category: NotificationCategory;
  subject: string;
  title: string;
  body: string;
  linkUrl?: string;
  data: Record<string, unknown>;
}

function pickString(
  payload: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
}

function isNotificationCategory(value: unknown): value is NotificationCategory {
  return (
    typeof value === 'string' &&
    (NotificationCategories as readonly string[]).includes(value)
  );
}

/**
 * Trích xuất người nhận và nội dung thông báo từ một event envelope.
 *
 * Quy tắc phân giải:
 * - `userId`: payload.customerId ?? payload.userId ?? payload.assigneeId
 *   (assigneeId dùng cho trường hợp nhân viên được phân công ticket hỗ trợ).
 * - `email`: payload.email ?? payload.customerEmail ?? payload.toEmail.
 * - Nếu không có mẫu thông báo tương ứng với eventType, hoặc không xác định
 *   được cả userId lẫn email, trả về `null` để service bỏ qua một cách an toàn.
 */
export function extractNotification(
  envelope: EventEnvelope,
): ExtractedNotification | null {
  const templateKey = String(envelope.eventType);
  if (!hasTemplate(templateKey)) {
    return null;
  }

  const payload = (envelope.payload ?? {}) as Record<string, unknown>;
  let userId = pickString(payload, ['customerId', 'userId', 'assigneeId']);
  const email = pickString(payload, ['email', 'customerEmail', 'toEmail']);

  // Staff trả lời ticket → thông báo cho khách; khách trả lời → thông báo cho assignee.
  if (envelope.eventType === 'support.ticket_message_added') {
    const authorType = pickString(payload, ['authorType']);
    if (authorType === 'STAFF') {
      userId = pickString(payload, ['customerId', 'userId']);
    } else if (authorType === 'CUSTOMER') {
      userId = pickString(payload, ['assigneeId', 'userId']);
    }
  } else if (envelope.eventType === 'support.ticket_assigned') {
    userId = pickString(payload, ['assigneeId', 'userId']);
  }

  if (!userId && !email) {
    return null;
  }

  const rendered = renderTemplate(templateKey, payload);
  const category = isNotificationCategory(payload['category'])
    ? payload['category']
    : rendered.category;
  const linkUrl =
    typeof payload['linkUrl'] === 'string' ? payload['linkUrl'] : undefined;

  return {
    userId,
    email,
    templateKey,
    category,
    subject: rendered.subject,
    title: rendered.title,
    body: rendered.body,
    linkUrl,
    data: payload,
  };
}
