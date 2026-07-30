import { AdminSupportController } from './admin-support.controller';
import { InMemoryEventPublisher } from './event-publisher';
import { InMemoryMediaClient } from './media.client';
import { InMemoryOrderClient } from './order.client';
import { InMemorySupportRepository } from './support.repository';
import { parseActor, SupportService } from './support.service';
import { TicketsController } from './tickets.controller';

function buildService() {
  const repository = new InMemorySupportRepository();
  const orders = new InMemoryOrderClient();
  const media = new InMemoryMediaClient();
  const publisher = new InMemoryEventPublisher();
  orders.seed({
    id: 'ord-1',
    orderCode: 'NT-1',
    customerId: 'cust-1',
    status: 'DELIVERED',
  });
  const service = new SupportService(repository, orders, media, publisher);
  return { service, repository, orders, media, publisher };
}

describe('TicketsController', () => {
  it('delegates create to service with parsed actor', async () => {
    const { service } = buildService();
    const controller = new TicketsController(service);
    const result = await controller.create('cust-1', 'Customer', undefined, {
      category: 'PRODUCT',
      subject: 'Sản phẩm gặp lỗi',
      description: 'Sản phẩm không lên nguồn sau khi mua 3 ngày.',
    });
    expect(result.status).toBe('OPEN');
    expect(result.customerId).toBe('cust-1');
    expect(parseActor('cust-1', 'Customer').userId).toBe('cust-1');
  });

  it('lists my tickets', async () => {
    const { service } = buildService();
    const controller = new TicketsController(service);
    await controller.create('cust-1', 'Customer', undefined, {
      category: 'PRODUCT',
      subject: 'Sản phẩm gặp lỗi',
      description: 'Sản phẩm không lên nguồn sau khi mua 3 ngày.',
    });
    const list = await controller.list('cust-1', 'Customer', {});
    expect(list.items).toHaveLength(1);
  });

  it('delegates get, addMessage, attachMedia and cancel', async () => {
    const { service, media } = buildService();
    const controller = new TicketsController(service);
    const created = await controller.create('cust-1', 'Customer', undefined, {
      category: 'PRODUCT',
      subject: 'Sản phẩm gặp lỗi',
      description: 'Sản phẩm không lên nguồn sau khi mua 3 ngày.',
    });

    const fetched = await controller.get(created.id, 'cust-1', 'Customer');
    expect(fetched.id).toBe(created.id);

    const withMessage = await controller.addMessage(
      created.id,
      'cust-1',
      'Customer',
      undefined,
      { content: 'Đây là tin nhắn bổ sung của khách hàng.' },
    );
    expect(withMessage.messages).toHaveLength(1);

    media.seed({
      id: 'media-1',
      uploadedBy: 'cust-1',
      mimeType: 'image/jpeg',
      status: 'active',
    });
    const withAttachment = await controller.attachMedia(
      created.id,
      'cust-1',
      'Customer',
      undefined,
      { mediaId: 'media-1' },
    );
    expect(withAttachment.attachments).toHaveLength(1);

    const cancelled = await controller.cancel(
      created.id,
      'cust-1',
      'Customer',
      undefined,
      {},
    );
    expect(cancelled.status).toBe('CANCELLED');
  });
});

describe('AdminSupportController', () => {
  it('lists tickets for staff', async () => {
    const { service } = buildService();
    const ticketsController = new TicketsController(service);
    const adminController = new AdminSupportController(service);
    await ticketsController.create('cust-1', 'Customer', undefined, {
      category: 'PRODUCT',
      subject: 'Sản phẩm gặp lỗi',
      description: 'Sản phẩm không lên nguồn sau khi mua 3 ngày.',
    });
    const result = await adminController.listTickets('staff-1', 'Staff', {});
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.customerId).toBe('cust-1');
  });

  it('delegates transition, messages, assign and priority updates', async () => {
    const { service } = buildService();
    const ticketsController = new TicketsController(service);
    const adminController = new AdminSupportController(service);
    const created = await ticketsController.create(
      'cust-1',
      'Customer',
      undefined,
      {
        category: 'PRODUCT',
        subject: 'Sản phẩm gặp lỗi',
        description: 'Sản phẩm không lên nguồn sau khi mua 3 ngày.',
      },
    );

    const transitioned = await adminController.transition(
      created.id,
      'staff-1',
      'Staff',
      undefined,
      { action: 'start' },
    );
    expect(transitioned.status).toBe('IN_PROGRESS');

    const messaged = await adminController.addMessage(
      created.id,
      'staff-1',
      'Staff',
      undefined,
      { content: 'Nhân viên phản hồi qua route quản trị.' },
    );
    expect(messaged.messages).toHaveLength(1);

    const assigned = await adminController.assign(
      created.id,
      'staff-1',
      'Staff',
      undefined,
      { assigneeId: 'staff-2' },
    );
    expect(assigned.assigneeId).toBe('staff-2');

    const prioritized = await adminController.updatePriority(
      created.id,
      'staff-1',
      'Staff',
      undefined,
      { priority: 'HIGH' },
    );
    expect(prioritized.priority).toBe('HIGH');
  });
});
