import { ErrorCodes } from '@nexatech/shared-errors';
import { createEventEnvelope, EventTypes } from '@nexatech/shared-events';
import { InMemoryEmailSender } from './email.sender';
import { InMemoryNotificationRepository } from './notification.repository';
import { NotificationService, parseActor } from './notification.service';

describe('NotificationService', () => {
  let repository: InMemoryNotificationRepository;
  let emailSender: InMemoryEmailSender;
  let service: NotificationService;

  const customer = parseActor('cust-1', 'Customer');
  const other = parseActor('cust-2', 'Customer');
  const staff = parseActor('staff-1', 'Staff');

  beforeEach(() => {
    process.env['NODE_ENV'] = 'test';
    delete process.env['NOTIFICATION_REQUIRE_SMTP'];
    delete process.env['SMTP_HOST'];
    repository = new InMemoryNotificationRepository();
    emailSender = new InMemoryEmailSender();
    service = new NotificationService(repository, emailSender);
  });

  describe('processEventEnvelope', () => {
    it('creates an in-app notification and sends an email for order.created', async () => {
      const envelope = createEventEnvelope({
        eventType: EventTypes.ORDER_CREATED,
        producer: 'order-service',
        traceId: 'trace-1',
        payload: {
          customerId: 'cust-1',
          email: 'cust-1@example.com',
          orderCode: 'NT-1',
        },
      });

      const result = await service.processEventEnvelope(envelope);
      expect(result.processed).toBe(true);
      expect(result.inApp?.userId).toBe('cust-1');
      expect(result.inApp?.category).toBe('ORDER');
      expect(result.email?.toEmail).toBe('cust-1@example.com');
      expect(result.email?.status).toBe('SENT');
      expect(emailSender.sent).toHaveLength(1);

      const unread = await repository.countUnread('cust-1');
      expect(unread).toBe(1);
    });

    it('is idempotent for the same eventId (inbox pattern)', async () => {
      const envelope = createEventEnvelope({
        eventType: EventTypes.ORDER_CONFIRMED,
        producer: 'order-service',
        traceId: 'trace-2',
        payload: { customerId: 'cust-1', orderCode: 'NT-2' },
        eventId: 'fixed-event-id-1',
      });

      const first = await service.processEventEnvelope(envelope);
      expect(first.processed).toBe(true);

      const second = await service.processEventEnvelope(envelope);
      expect(second.processed).toBe(false);

      const unread = await repository.countUnread('cust-1');
      expect(unread).toBe(1);
    });

    it('creates only an in-app notification when no email is present', async () => {
      const envelope = createEventEnvelope({
        eventType: EventTypes.SUPPORT_TICKET_ASSIGNED,
        producer: 'support-service',
        traceId: 'trace-3',
        payload: { ticketId: 'ticket-1', assigneeId: 'staff-1' },
      });
      const result = await service.processEventEnvelope(envelope);
      expect(result.inApp?.userId).toBe('staff-1');
      expect(result.email).toBeUndefined();
    });

    it('creates only an email delivery when there is no userId', async () => {
      const envelope = createEventEnvelope({
        eventType: EventTypes.PAYMENT_PAID,
        producer: 'payment-service',
        traceId: 'trace-4',
        payload: { customerEmail: 'no-user@example.com', orderCode: 'NT-4' },
      });
      const result = await service.processEventEnvelope(envelope);
      expect(result.inApp).toBeUndefined();
      expect(result.email?.toEmail).toBe('no-user@example.com');
    });

    it('skips events with no matching template or no resolvable recipient', async () => {
      const envelope = createEventEnvelope({
        eventType: EventTypes.CART_CREATED,
        producer: 'cart-service',
        traceId: 'trace-5',
        payload: { cartId: 'cart-1' },
      });
      const result = await service.processEventEnvelope(envelope);
      expect(result.processed).toBe(true);
      expect(result.inApp).toBeUndefined();
      expect(result.email).toBeUndefined();
    });

    it('marks email as SKIPPED when NOTIFICATION_REQUIRE_SMTP=true and no SMTP configured', async () => {
      process.env['NOTIFICATION_REQUIRE_SMTP'] = 'true';
      process.env['NODE_ENV'] = 'production';
      try {
        const envelope = createEventEnvelope({
          eventType: EventTypes.PAYMENT_FAILED,
          producer: 'payment-service',
          traceId: 'trace-6',
          payload: { customerEmail: 'skip@example.com', orderCode: 'NT-5' },
        });
        const result = await service.processEventEnvelope(envelope);
        expect(result.email?.status).toBe('SKIPPED');
        expect(emailSender.sent).toHaveLength(0);
      } finally {
        process.env['NODE_ENV'] = 'test';
      }
    });
  });

  describe('inbox / manual processEvent for support.ticket_message_added', () => {
    it('returns null recipient and does not throw when payload lacks identifiers', async () => {
      const envelope = createEventEnvelope({
        eventType: EventTypes.SUPPORT_TICKET_MESSAGE_ADDED,
        producer: 'support-service',
        traceId: 'trace-7',
        payload: { ticketId: 'ticket-1', authorType: 'STAFF' },
      });
      const result = await service.processEventEnvelope(envelope);
      expect(result.inApp).toBeUndefined();
      expect(result.email).toBeUndefined();
      expect(result.processed).toBe(true);
    });
  });

  describe('self-service inbox', () => {
    async function seedNotification(userId: string) {
      return repository.createInApp({
        userId,
        category: 'ORDER',
        templateKey: 'order.created',
        title: 'Đơn hàng NT-1 đã được tạo',
        body: 'Đơn hàng NT-1 của bạn đã được tạo thành công.',
      });
    }

    it('lists only the caller notifications', async () => {
      await seedNotification('cust-1');
      await seedNotification('cust-2');
      const result = await service.listNotifications(customer, {});
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.userId).toBe('cust-1');
    });

    it('returns unread count for the caller', async () => {
      await seedNotification('cust-1');
      await seedNotification('cust-1');
      const result = await service.unreadCount(customer);
      expect(result.count).toBe(2);
    });

    it('marks a notification as read only for its owner', async () => {
      const created = await seedNotification('cust-1');
      const marked = await service.markRead(customer, created.id);
      expect(marked.readAt).toBeDefined();

      await expect(service.markRead(other, created.id)).rejects.toMatchObject({
        errorCode: ErrorCodes.NOTIFICATION_FORBIDDEN,
      });
    });

    it('rejects marking an already-read notification as read again', async () => {
      const created = await seedNotification('cust-1');
      await service.markRead(customer, created.id);
      await expect(
        service.markRead(customer, created.id),
      ).rejects.toMatchObject({
        errorCode: ErrorCodes.NOTIFICATION_ALREADY_READ,
      });
    });

    it('throws NOTIFICATION_NOT_FOUND for unknown notification id', async () => {
      await expect(
        service.markRead(customer, 'does-not-exist'),
      ).rejects.toMatchObject({ errorCode: ErrorCodes.NOTIFICATION_NOT_FOUND });
    });

    it('marks all notifications as read for the caller (safe when run concurrently)', async () => {
      await seedNotification('cust-1');
      await seedNotification('cust-1');
      await seedNotification('cust-1');

      const [a, b] = await Promise.all([
        service.markAllRead(customer),
        service.markAllRead(customer),
      ]);
      expect(a.updated + b.updated).toBe(3);

      const unread = await repository.countUnread('cust-1');
      expect(unread).toBe(0);
    });

    it('soft-deletes a notification owned by the caller', async () => {
      const created = await seedNotification('cust-1');
      await service.deleteNotification(customer, created.id);
      const result = await service.listNotifications(customer, {});
      expect(result.items).toHaveLength(0);
    });

    it('forbids deleting a notification owned by another user', async () => {
      const created = await seedNotification('cust-1');
      await expect(
        service.deleteNotification(other, created.id),
      ).rejects.toMatchObject({ errorCode: ErrorCodes.NOTIFICATION_FORBIDDEN });
    });

    it('requires authentication for self-service endpoints', async () => {
      const anonymous = parseActor(undefined, undefined);
      await expect(
        service.listNotifications(anonymous, {}),
      ).rejects.toMatchObject({
        errorCode: ErrorCodes.UNAUTHORIZED,
      });
    });
  });

  describe('requestNotification (staff+)', () => {
    it('rejects non-staff actors', async () => {
      await expect(
        service.requestNotification(customer, {
          userId: 'cust-1',
          templateKey: 'notification.requested',
          title: 'Xin chào',
          body: 'Nội dung',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCodes.FORBIDDEN });
    });

    it('requires at least a userId or an email', async () => {
      await expect(
        service.requestNotification(staff, {
          templateKey: 'notification.requested',
          title: 'Xin chào',
          body: 'Nội dung',
        }),
      ).rejects.toMatchObject({
        errorCode: ErrorCodes.NOTIFICATION_RECIPIENT_REQUIRED,
      });
    });

    it('creates in-app and email channels using the generic template', async () => {
      const result = await service.requestNotification(staff, {
        userId: 'cust-1',
        email: 'cust-1@example.com',
        templateKey: 'notification.requested',
        title: 'Thông báo hệ thống',
        body: 'Hệ thống sẽ bảo trì lúc 23h hôm nay.',
      });
      expect(result.inApp?.userId).toBe('cust-1');
      expect(result.inApp?.title).toBe('Thông báo hệ thống');
      expect(result.email?.toEmail).toBe('cust-1@example.com');
      expect(emailSender.sent).toHaveLength(1);
    });

    it('uses a registered template when title/body are omitted', async () => {
      const result = await service.requestNotification(staff, {
        userId: 'cust-1',
        templateKey: 'order.created',
        data: { orderCode: 'NT-9' },
      });
      expect(result.inApp?.title).toContain('NT-9');
      expect(result.inApp?.category).toBe('SYSTEM');
    });

    it('throws NOTIFICATION_TEMPLATE_NOT_FOUND for unknown template without title/body', async () => {
      await expect(
        service.requestNotification(staff, {
          userId: 'cust-1',
          templateKey: 'unknown.template',
        }),
      ).rejects.toMatchObject({
        errorCode: ErrorCodes.NOTIFICATION_TEMPLATE_NOT_FOUND,
      });
    });

    it('only creates requested channels', async () => {
      const result = await service.requestNotification(staff, {
        userId: 'cust-1',
        email: 'cust-1@example.com',
        templateKey: 'notification.requested',
        title: 'Chỉ email',
        body: 'Nội dung chỉ email',
        channels: ['EMAIL'],
      });
      expect(result.inApp).toBeUndefined();
      expect(result.email).toBeDefined();
    });

    it('is idempotent for repeated idempotencyKey', async () => {
      const first = await service.requestNotification(staff, {
        userId: 'cust-1',
        templateKey: 'notification.requested',
        title: 'Trùng lặp',
        body: 'Nội dung trùng lặp',
        idempotencyKey: 'request-key-1',
      });
      const again = await service.requestNotification(staff, {
        userId: 'cust-1',
        templateKey: 'notification.requested',
        title: 'Trùng lặp',
        body: 'Nội dung trùng lặp',
        idempotencyKey: 'request-key-1',
      });
      expect(again.inApp?.id).toBe(first.inApp?.id);
      expect(emailSender.sent).toHaveLength(0);
    });

    it('accepts an Idempotency-Key header as fallback when body omits it', async () => {
      const first = await service.requestNotification(
        staff,
        {
          userId: 'cust-1',
          templateKey: 'notification.requested',
          title: 'Header idempotency',
          body: 'Nội dung',
        },
        'trace-x',
        'header-idem-key-1',
      );
      const again = await service.requestNotification(
        staff,
        {
          userId: 'cust-1',
          templateKey: 'notification.requested',
          title: 'Header idempotency',
          body: 'Nội dung',
        },
        'trace-x',
        'header-idem-key-1',
      );
      expect(again.inApp?.id).toBe(first.inApp?.id);
    });
  });

  describe('admin — email deliveries', () => {
    it('lists email deliveries filtered by status for staff', async () => {
      await service.requestNotification(staff, {
        email: 'a@example.com',
        templateKey: 'notification.requested',
        title: 'A',
        body: 'A body',
      });
      await service.requestNotification(staff, {
        email: 'b@example.com',
        templateKey: 'notification.requested',
        title: 'B',
        body: 'B body',
      });

      const sent = await service.listEmailDeliveries(staff, {
        status: 'SENT',
      });
      expect(sent.items.length).toBeGreaterThanOrEqual(2);
    });

    it('rejects non-staff actors from listing email deliveries', async () => {
      await expect(
        service.listEmailDeliveries(customer, {}),
      ).rejects.toMatchObject({ errorCode: ErrorCodes.FORBIDDEN });
    });
  });
});
