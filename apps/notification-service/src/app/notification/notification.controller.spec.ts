import { AdminNotificationsController } from './admin-notifications.controller';
import { InMemoryEmailSender } from './email.sender';
import { InMemoryNotificationRepository } from './notification.repository';
import { NotificationService, parseActor } from './notification.service';
import { NotificationsController } from './notifications.controller';

function buildService() {
  const repository = new InMemoryNotificationRepository();
  const emailSender = new InMemoryEmailSender();
  const service = new NotificationService(repository, emailSender);
  return { service, repository, emailSender };
}

describe('NotificationsController', () => {
  beforeEach(() => {
    process.env['NODE_ENV'] = 'test';
  });

  it('lists notifications for the caller using x-user-id header', async () => {
    const { service } = buildService();
    const controller = new NotificationsController(service);
    await service.requestNotification(parseActor('staff-1', 'Staff'), {
      userId: 'cust-1',
      templateKey: 'notification.requested',
      title: 'Xin chào',
      body: 'Nội dung',
    });
    const result = await controller.list('cust-1', 'Customer', {});
    expect(result.items).toHaveLength(1);
    expect(parseActor('cust-1', 'Customer,Staff').roles).toEqual([
      'Customer',
      'Staff',
    ]);
  });

  it('returns unread count', async () => {
    const { service } = buildService();
    const controller = new NotificationsController(service);
    await service.requestNotification(parseActor('staff-1', 'Staff'), {
      userId: 'cust-1',
      templateKey: 'notification.requested',
      title: 'Xin chào',
      body: 'Nội dung',
    });
    const result = await controller.unreadCount('cust-1', 'Customer');
    expect(result.count).toBe(1);
  });

  it('marks a notification as read, marks all read, and deletes', async () => {
    const { service } = buildService();
    const controller = new NotificationsController(service);
    const created = await service.requestNotification(
      parseActor('staff-1', 'Staff'),
      {
        userId: 'cust-1',
        templateKey: 'notification.requested',
        title: 'Xin chào',
        body: 'Nội dung',
      },
    );
    const id = created.inApp?.id as string;

    const marked = await controller.markRead(id, 'cust-1', 'Customer');
    expect(marked.readAt).toBeDefined();

    const allRead = await controller.markAllRead('cust-1', 'Customer');
    expect(allRead.updated).toBe(0);

    await controller.remove(id, 'cust-1', 'Customer');
    const listed = await controller.list('cust-1', 'Customer', {});
    expect(listed.items).toHaveLength(0);
  });

  it('delegates staff-triggered notification requests', async () => {
    const { service } = buildService();
    const controller = new NotificationsController(service);
    const result = await controller.request(
      'staff-1',
      'Staff',
      'trace-1',
      undefined,
      {
        userId: 'cust-1',
        templateKey: 'notification.requested',
        title: 'Chào bạn',
        body: 'Nội dung thông báo',
      },
    );
    expect(result.inApp?.userId).toBe('cust-1');
  });
});

describe('AdminNotificationsController', () => {
  beforeEach(() => {
    process.env['NODE_ENV'] = 'test';
  });

  it('lists email deliveries for staff', async () => {
    const { service } = buildService();
    const controller = new AdminNotificationsController(service);
    await service.requestNotification(parseActor('staff-1', 'Staff'), {
      email: 'a@example.com',
      templateKey: 'notification.requested',
      title: 'A',
      body: 'A body',
    });
    const result = await controller.listEmailDeliveries('staff-1', 'Staff', {});
    expect(result.items.length).toBeGreaterThanOrEqual(1);
  });

  it('rejects non-staff actors', async () => {
    const { service } = buildService();
    const controller = new AdminNotificationsController(service);
    await expect(
      controller.listEmailDeliveries('cust-1', 'Customer', {}),
    ).rejects.toMatchObject({ errorCode: 'FORBIDDEN' });
  });
});
