import { ErrorCodes } from '@nexatech/shared-errors';
import {
  getTemplate,
  hasTemplate,
  listTemplateKeys,
  renderTemplate,
} from './templates';

describe('templates', () => {
  it('renders order.created with interpolated orderCode', () => {
    const rendered = renderTemplate('order.created', {
      orderCode: 'NT-20260730-000001',
    });
    expect(rendered.category).toBe('ORDER');
    expect(rendered.title).toContain('NT-20260730-000001');
    expect(rendered.body).toContain('NT-20260730-000001');
  });

  it('renders payment.failed template', () => {
    const rendered = renderTemplate('payment.failed', {
      orderCode: 'NT-1',
    });
    expect(rendered.category).toBe('PAYMENT');
    expect(rendered.subject).toContain('NT-1');
  });

  it('renders shipment.delivery-failed with reason', () => {
    const rendered = renderTemplate('shipment.delivery-failed', {
      orderCode: 'NT-2',
      reason: 'Không có người nhận',
    });
    expect(rendered.body).toContain('NT-2');
    expect(rendered.body).toContain('Không có người nhận');
  });

  it('renders support.ticket_created in Vietnamese', () => {
    const rendered = renderTemplate('support.ticket_created', {
      ticketCode: 'NT-S-20260730-ABC123',
    });
    expect(rendered.category).toBe('SUPPORT');
    expect(rendered.title).toBe('Yêu cầu hỗ trợ đã được tạo');
    expect(rendered.body).toContain('NT-S-20260730-ABC123');
  });

  it('renders the generic notification.requested template from payload title/body', () => {
    const rendered = renderTemplate('notification.requested', {
      title: 'Tiêu đề tuỳ chỉnh',
      body: 'Nội dung tuỳ chỉnh',
    });
    expect(rendered.category).toBe('SYSTEM');
    expect(rendered.title).toBe('Tiêu đề tuỳ chỉnh');
    expect(rendered.body).toBe('Nội dung tuỳ chỉnh');
  });

  it('leaves missing interpolation variables blank instead of throwing', () => {
    const rendered = renderTemplate('order.cancelled', { orderCode: 'NT-3' });
    expect(rendered.body).toContain('NT-3');
    expect(rendered.body).toContain('Lý do: .');
  });

  it('throws NOTIFICATION_TEMPLATE_NOT_FOUND for unknown template key', () => {
    expect(() => getTemplate('unknown.template.key')).toThrow();
    try {
      getTemplate('unknown.template.key');
      fail('should have thrown');
    } catch (error) {
      expect((error as { errorCode: string }).errorCode).toBe(
        ErrorCodes.NOTIFICATION_TEMPLATE_NOT_FOUND,
      );
    }
  });

  it('renderTemplate throws for unknown template key as well', () => {
    expect(() => renderTemplate('does.not.exist')).toThrow();
  });

  it('hasTemplate correctly reports known and unknown keys', () => {
    expect(hasTemplate('order.created')).toBe(true);
    expect(hasTemplate('support.ticket_message_added')).toBe(true);
    expect(hasTemplate('does.not.exist')).toBe(false);
  });

  it('exposes all documented template keys', () => {
    const keys = listTemplateKeys();
    const expected = [
      'user.registered',
      'identity.welcome',
      'user.email_verified',
      'user.password_reset_requested',
      'order.created',
      'order.confirmed',
      'order.shipped',
      'order.delivered',
      'order.cancelled',
      'payment.paid',
      'payment.failed',
      'payment.refunded',
      'shipment.out-for-delivery',
      'shipment.delivered',
      'shipment.delivery-failed',
      'review.published',
      'review.reply.created',
      'review.rejected',
      'warranty.claim_approved',
      'warranty.claim_rejected',
      'warranty.claim_completed',
      'warranty.return_approved',
      'warranty.return_rejected',
      'warranty.return_completed',
      'support.ticket_created',
      'support.ticket_assigned',
      'support.ticket_resolved',
      'support.ticket_closed',
      'support.ticket_message_added',
      'notification.requested',
    ];
    for (const key of expected) {
      expect(keys).toContain(key);
    }
  });
});
