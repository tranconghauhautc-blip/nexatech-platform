import { ErrorCodes } from '@nexatech/shared-errors';
import { EventTypes } from '@nexatech/shared-events';
import { InMemoryEventPublisher } from './event-publisher';
import { InMemoryMediaClient } from './media.client';
import { InMemoryOrderClient } from './order.client';
import { InMemorySupportRepository } from './support.repository';
import { parseActor, SupportService } from './support.service';
import type { OrderSnapshot } from './support.types';

describe('SupportService', () => {
  let repository: InMemorySupportRepository;
  let orders: InMemoryOrderClient;
  let media: InMemoryMediaClient;
  let publisher: InMemoryEventPublisher;
  let service: SupportService;

  const customer = parseActor('cust-1', 'Customer');
  const other = parseActor('cust-2', 'Customer');
  const staff = parseActor('staff-1', 'Staff');

  function seedOwnOrder(overrides: Partial<OrderSnapshot> = {}): OrderSnapshot {
    const order: OrderSnapshot = {
      id: 'ord-1',
      orderCode: 'NT-20260730-000001',
      customerId: 'cust-1',
      status: 'DELIVERED',
      ...overrides,
    };
    orders.seed(order);
    return order;
  }

  beforeEach(() => {
    process.env['NODE_ENV'] = 'test';
    repository = new InMemorySupportRepository();
    orders = new InMemoryOrderClient();
    media = new InMemoryMediaClient();
    publisher = new InMemoryEventPublisher();
    media.seed({
      id: 'media-1',
      uploadedBy: 'cust-1',
      mimeType: 'image/jpeg',
      status: 'active',
    });
    service = new SupportService(repository, orders, media, publisher);
    seedOwnOrder();
  });

  describe('create ticket', () => {
    it('creates a ticket for authenticated customer and publishes event', async () => {
      const ticket = await service.createTicket(customer, {
        category: 'PRODUCT',
        subject: 'Sản phẩm gặp lỗi',
        description: 'Sản phẩm không lên nguồn sau khi mua 3 ngày.',
      });
      expect(ticket.status).toBe('OPEN');
      expect(ticket.category).toBe('PRODUCT');
      expect(ticket.priority).toBe('NORMAL');
      expect(ticket.customerId).toBe('cust-1');
      expect(ticket.ticketCode).toMatch(/^NT-S-\d{8}-[0-9A-Z]{6}$/);

      const events = publisher.published.map((e) => e.eventType);
      expect(events).toContain(EventTypes.SUPPORT_TICKET_CREATED);
    });

    it('rejects ticket creation from staff actors (customer only)', async () => {
      await expect(
        service.createTicket(staff, {
          category: 'OTHER',
          subject: 'Yêu cầu thay mặt khách hàng',
          description: 'Nhân viên không được tự tạo ticket hỗ trợ.',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCodes.FORBIDDEN });
    });

    it('links an order that belongs to the customer', async () => {
      const ticket = await service.createTicket(customer, {
        category: 'ORDER',
        subject: 'Hỏi về đơn hàng của tôi',
        description: 'Đơn hàng của tôi chưa được giao đúng hẹn.',
        orderId: 'ord-1',
      });
      expect(ticket.orderId).toBe('ord-1');
    });

    it('rejects linking an order that belongs to another customer', async () => {
      seedOwnOrder({ id: 'ord-2', customerId: 'cust-2' });
      await expect(
        service.createTicket(customer, {
          category: 'ORDER',
          subject: 'Hỏi về đơn hàng không phải của tôi',
          description: 'Cố ý liên kết với đơn hàng của người khác.',
          orderId: 'ord-2',
        }),
      ).rejects.toMatchObject({
        errorCode: ErrorCodes.SUPPORT_ORDER_FORBIDDEN,
      });
    });

    it('rejects linking an unavailable order', async () => {
      await expect(
        service.createTicket(customer, {
          category: 'ORDER',
          subject: 'Đơn hàng không tồn tại',
          description: 'Mã đơn hàng không có trong hệ thống order-service.',
          orderId: 'ord-missing',
        }),
      ).rejects.toMatchObject({
        errorCode: ErrorCodes.SUPPORT_ORDER_UNAVAILABLE,
      });
    });

    it('rejects providing both warrantyClaimId and returnRequestId', async () => {
      await expect(
        service.createTicket(customer, {
          category: 'WARRANTY',
          subject: 'Câu hỏi về bảo hành và đổi trả',
          description: 'Vừa muốn hỏi bảo hành vừa muốn hỏi đổi trả cùng lúc.',
          warrantyClaimId: 'claim-1',
          returnRequestId: 'return-1',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCodes.SUPPORT_LINK_INVALID });
    });

    it('validates media ownership, mime type and limits', async () => {
      media.seed({
        id: 'media-other',
        uploadedBy: 'cust-2',
        mimeType: 'image/png',
        status: 'active',
      });
      await expect(
        service.createTicket(customer, {
          category: 'PRODUCT',
          subject: 'Gắn media của người khác',
          description: 'Thử gắn media không thuộc quyền sở hữu của mình.',
          mediaIds: ['media-other'],
        }),
      ).rejects.toMatchObject({
        errorCode: ErrorCodes.SUPPORT_MEDIA_FORBIDDEN,
      });

      media.seed({
        id: 'media-video',
        uploadedBy: 'cust-1',
        mimeType: 'video/mp4',
        status: 'active',
      });
      await expect(
        service.createTicket(customer, {
          category: 'PRODUCT',
          subject: 'Đính kèm video không hợp lệ',
          description: 'Chỉ chấp nhận ảnh, không chấp nhận video đính kèm.',
          mediaIds: ['media-video'],
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCodes.SUPPORT_MEDIA_INVALID });

      const ticket = await service.createTicket(customer, {
        category: 'PRODUCT',
        subject: 'Có một ảnh hợp lệ kèm theo',
        description: 'Đính kèm một ảnh hợp lệ khi tạo yêu cầu hỗ trợ.',
        mediaIds: ['media-1'],
      });
      expect(ticket.attachments).toHaveLength(1);

      for (let i = 2; i <= 5; i += 1) {
        media.seed({
          id: `media-${i}`,
          uploadedBy: 'cust-1',
          mimeType: 'image/jpeg',
          status: 'active',
        });
        await service.attachTicketMedia(customer, ticket.id, {
          mediaId: `media-${i}`,
        });
      }
      media.seed({
        id: 'media-6',
        uploadedBy: 'cust-1',
        mimeType: 'image/jpeg',
        status: 'active',
      });
      await expect(
        service.attachTicketMedia(customer, ticket.id, {
          mediaId: 'media-6',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCodes.SUPPORT_MEDIA_LIMIT });
    });

    it('supports idempotent ticket creation', async () => {
      const first = await service.createTicket(customer, {
        category: 'ACCOUNT',
        subject: 'Không đăng nhập được vào tài khoản',
        description: 'Tài khoản báo lỗi mật khẩu sai dù đã đổi mật khẩu mới.',
        idempotencyKey: 'create-ticket-1',
      });
      const again = await service.createTicket(customer, {
        category: 'ACCOUNT',
        subject: 'Không đăng nhập được vào tài khoản',
        description: 'Tài khoản báo lỗi mật khẩu sai dù đã đổi mật khẩu mới.',
        idempotencyKey: 'create-ticket-1',
      });
      expect(again.id).toBe(first.id);
      const createdEvents = publisher.published.filter(
        (e) => e.eventType === EventTypes.SUPPORT_TICKET_CREATED,
      );
      expect(createdEvents).toHaveLength(1);
    });
  });

  describe('messages', () => {
    it('auto-transitions WAITING_CUSTOMER -> WAITING_STAFF on customer reply', async () => {
      const ticket = await service.createTicket(customer, {
        category: 'PRODUCT',
        subject: 'Sản phẩm gặp lỗi',
        description: 'Sản phẩm không lên nguồn sau khi mua 3 ngày.',
      });
      await service.adminTransitionTicket(staff, ticket.id, {
        action: 'start',
      });
      const waiting = await service.adminTransitionTicket(staff, ticket.id, {
        action: 'wait_customer',
      });
      expect(waiting.status).toBe('WAITING_CUSTOMER');

      const afterReply = await service.addMessage(customer, ticket.id, {
        content: 'Tôi đã thử khởi động lại nhưng vẫn không lên nguồn.',
      });
      expect(afterReply.status).toBe('WAITING_STAFF');
      expect(afterReply.messages).toHaveLength(1);

      const events = publisher.published.map((e) => e.eventType);
      expect(events).toContain(EventTypes.SUPPORT_TICKET_MESSAGE_ADDED);
      expect(events).toContain(EventTypes.SUPPORT_TICKET_UPDATED);
    });

    it('does not auto-change status when staff sends a message', async () => {
      const ticket = await service.createTicket(customer, {
        category: 'PRODUCT',
        subject: 'Sản phẩm gặp lỗi',
        description: 'Sản phẩm không lên nguồn sau khi mua 3 ngày.',
      });
      const afterStaffMessage = await service.addMessage(staff, ticket.id, {
        content: 'Chúng tôi đã tiếp nhận yêu cầu của bạn.',
      });
      expect(afterStaffMessage.status).toBe('OPEN');
      expect(afterStaffMessage.messages[0]?.authorType).toBe('STAFF');
    });

    it('rejects messages on a closed or cancelled ticket', async () => {
      const ticket = await service.createTicket(customer, {
        category: 'PRODUCT',
        subject: 'Sản phẩm gặp lỗi',
        description: 'Sản phẩm không lên nguồn sau khi mua 3 ngày.',
      });
      await service.cancelTicket(customer, ticket.id, {});
      await expect(
        service.addMessage(customer, ticket.id, {
          content: 'Ticket đã hủy nhưng vẫn muốn gửi tin nhắn.',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCodes.SUPPORT_CLOSED });
    });

    it('rejects messages from a user who is neither owner nor staff', async () => {
      const ticket = await service.createTicket(customer, {
        category: 'PRODUCT',
        subject: 'Sản phẩm gặp lỗi',
        description: 'Sản phẩm không lên nguồn sau khi mua 3 ngày.',
      });
      await expect(
        service.addMessage(other, ticket.id, {
          content: 'Tôi không phải chủ ticket này.',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCodes.SUPPORT_FORBIDDEN });
    });
  });

  describe('cancel', () => {
    it('allows customer to cancel from OPEN or WAITING_CUSTOMER', async () => {
      const ticket = await service.createTicket(customer, {
        category: 'PRODUCT',
        subject: 'Sản phẩm gặp lỗi',
        description: 'Sản phẩm không lên nguồn sau khi mua 3 ngày.',
      });
      const cancelled = await service.cancelTicket(customer, ticket.id, {
        reason: 'Đã tự khắc phục được sự cố',
      });
      expect(cancelled.status).toBe('CANCELLED');

      const ticket2 = await service.createTicket(customer, {
        category: 'PRODUCT',
        subject: 'Sản phẩm gặp lỗi khác',
        description: 'Một sự cố khác với sản phẩm đã mua trước đó.',
      });
      await service.adminTransitionTicket(staff, ticket2.id, {
        action: 'start',
      });
      await service.adminTransitionTicket(staff, ticket2.id, {
        action: 'wait_customer',
      });
      const cancelled2 = await service.cancelTicket(customer, ticket2.id, {});
      expect(cancelled2.status).toBe('CANCELLED');
    });

    it('forbids customer from cancelling while IN_PROGRESS or WAITING_STAFF', async () => {
      const ticket = await service.createTicket(customer, {
        category: 'PRODUCT',
        subject: 'Sản phẩm gặp lỗi',
        description: 'Sản phẩm không lên nguồn sau khi mua 3 ngày.',
      });
      await service.adminTransitionTicket(staff, ticket.id, {
        action: 'start',
      });
      await expect(
        service.cancelTicket(customer, ticket.id, {}),
      ).rejects.toMatchObject({
        errorCode: ErrorCodes.SUPPORT_INVALID_TRANSITION,
      });
    });

    it('allows staff to cancel from any non-terminal status', async () => {
      const ticket = await service.createTicket(customer, {
        category: 'PRODUCT',
        subject: 'Sản phẩm gặp lỗi',
        description: 'Sản phẩm không lên nguồn sau khi mua 3 ngày.',
      });
      await service.adminTransitionTicket(staff, ticket.id, {
        action: 'start',
      });
      const cancelled = await service.cancelTicket(staff, ticket.id, {
        reason: 'Khách hàng không phản hồi',
      });
      expect(cancelled.status).toBe('CANCELLED');
    });

    it('rejects cancel from another customer', async () => {
      const ticket = await service.createTicket(customer, {
        category: 'PRODUCT',
        subject: 'Sản phẩm gặp lỗi',
        description: 'Sản phẩm không lên nguồn sau khi mua 3 ngày.',
      });
      await expect(
        service.cancelTicket(other, ticket.id, {}),
      ).rejects.toMatchObject({ errorCode: ErrorCodes.SUPPORT_FORBIDDEN });
    });
  });

  describe('admin operations', () => {
    it('walks through the full ticket lifecycle as staff', async () => {
      const ticket = await service.createTicket(customer, {
        category: 'PRODUCT',
        subject: 'Sản phẩm gặp lỗi',
        description: 'Sản phẩm không lên nguồn sau khi mua 3 ngày.',
      });

      await expect(
        service.adminTransitionTicket(customer, ticket.id, {
          action: 'start',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCodes.FORBIDDEN });

      const inProgress = await service.adminTransitionTicket(staff, ticket.id, {
        action: 'start',
      });
      expect(inProgress.status).toBe('IN_PROGRESS');

      const resolved = await service.adminTransitionTicket(staff, ticket.id, {
        action: 'resolve',
      });
      expect(resolved.status).toBe('RESOLVED');
      const events1 = publisher.published.map((e) => e.eventType);
      expect(events1).toContain(EventTypes.SUPPORT_TICKET_RESOLVED);

      const reopened = await service.adminTransitionTicket(staff, ticket.id, {
        action: 'reopen',
      });
      expect(reopened.status).toBe('IN_PROGRESS');

      const closed = await service.adminTransitionTicket(staff, ticket.id, {
        action: 'close',
      });
      expect(closed.status).toBe('CLOSED');
      const events2 = publisher.published.map((e) => e.eventType);
      expect(events2).toContain(EventTypes.SUPPORT_TICKET_CLOSED);

      await expect(
        service.adminTransitionTicket(staff, ticket.id, {
          action: 'reopen',
        }),
      ).rejects.toMatchObject({
        errorCode: ErrorCodes.SUPPORT_INVALID_TRANSITION,
      });
    });

    it('assigns a ticket to a staff member and publishes an event', async () => {
      const ticket = await service.createTicket(customer, {
        category: 'PRODUCT',
        subject: 'Sản phẩm gặp lỗi',
        description: 'Sản phẩm không lên nguồn sau khi mua 3 ngày.',
      });
      await expect(
        service.adminAssignTicket(customer, ticket.id, {
          assigneeId: 'staff-1',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCodes.FORBIDDEN });

      const assigned = await service.adminAssignTicket(staff, ticket.id, {
        assigneeId: 'staff-1',
      });
      expect(assigned.assigneeId).toBe('staff-1');
      const events = publisher.published.map((e) => e.eventType);
      expect(events).toContain(EventTypes.SUPPORT_TICKET_ASSIGNED);
    });

    it('updates ticket priority', async () => {
      const ticket = await service.createTicket(customer, {
        category: 'PRODUCT',
        subject: 'Sản phẩm gặp lỗi',
        description: 'Sản phẩm không lên nguồn sau khi mua 3 ngày.',
      });
      const updated = await service.adminUpdatePriority(staff, ticket.id, {
        priority: 'URGENT',
      });
      expect(updated.priority).toBe('URGENT');
    });

    it('allows staff to reply via the admin message endpoint', async () => {
      const ticket = await service.createTicket(customer, {
        category: 'PRODUCT',
        subject: 'Sản phẩm gặp lỗi',
        description: 'Sản phẩm không lên nguồn sau khi mua 3 ngày.',
      });
      await expect(
        service.adminAddMessage(customer, ticket.id, {
          content: 'Khách hàng không được dùng route admin.',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCodes.FORBIDDEN });

      const updated = await service.adminAddMessage(staff, ticket.id, {
        content: 'Nhân viên trả lời qua route quản trị.',
      });
      expect(updated.messages).toHaveLength(1);
      expect(updated.messages[0]?.authorType).toBe('STAFF');
    });

    it('enforces staff-only access for admin listing/detail', async () => {
      const ticket = await service.createTicket(customer, {
        category: 'PRODUCT',
        subject: 'Sản phẩm gặp lỗi',
        description: 'Sản phẩm không lên nguồn sau khi mua 3 ngày.',
      });
      await expect(
        service.adminListTickets(customer, {}),
      ).rejects.toMatchObject({ errorCode: ErrorCodes.FORBIDDEN });

      const list = await service.adminListTickets(staff, {});
      expect(list.items.length).toBeGreaterThanOrEqual(1);

      const detail = await service.adminGetTicket(staff, ticket.id);
      expect(detail.history.length).toBeGreaterThanOrEqual(1);
      expect(detail.customerId).toBe('cust-1');
    });
  });

  describe('concurrency & idempotency', () => {
    it('detects version conflicts on concurrent transitions', async () => {
      const ticket = await service.createTicket(customer, {
        category: 'PRODUCT',
        subject: 'Sản phẩm gặp lỗi',
        description: 'Sản phẩm không lên nguồn sau khi mua 3 ngày.',
      });
      await service.adminTransitionTicket(staff, ticket.id, {
        action: 'start',
        expectedVersion: 0,
      });
      await expect(
        service.adminTransitionTicket(staff, ticket.id, {
          action: 'resolve',
          expectedVersion: 0,
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCodes.SUPPORT_CONFLICT });
    });

    it('returns cached response for a repeated idempotency key on transition', async () => {
      const ticket = await service.createTicket(customer, {
        category: 'PRODUCT',
        subject: 'Sản phẩm gặp lỗi',
        description: 'Sản phẩm không lên nguồn sau khi mua 3 ngày.',
      });
      const first = await service.adminTransitionTicket(staff, ticket.id, {
        action: 'start',
        idempotencyKey: 'start-key-1',
      });
      const repeated = await service.adminTransitionTicket(staff, ticket.id, {
        action: 'start',
        idempotencyKey: 'start-key-1',
      });
      expect(repeated.status).toBe(first.status);
      expect(repeated.version).toBe(first.version);
    });

    it('rejects reusing an idempotency key across different operations', async () => {
      const ticket = await service.createTicket(customer, {
        category: 'PRODUCT',
        subject: 'Sản phẩm gặp lỗi',
        description: 'Sản phẩm không lên nguồn sau khi mua 3 ngày.',
        idempotencyKey: 'shared-key-1',
      });
      await expect(
        service.cancelTicket(customer, ticket.id, {
          idempotencyKey: 'shared-key-1',
        }),
      ).rejects.toMatchObject({
        errorCode: ErrorCodes.SUPPORT_IDEMPOTENCY_CONFLICT,
      });
    });
  });
});
