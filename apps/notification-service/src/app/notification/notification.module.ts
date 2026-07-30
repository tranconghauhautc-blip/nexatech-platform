import { Module } from '@nestjs/common';
import { AdminNotificationsController } from './admin-notifications.controller';
import { createEmailSender, type EmailSender } from './email.sender';
import { EventConsumer } from './event-consumer';
import { NotificationService } from './notification.service';
import { NotificationsController } from './notifications.controller';
import {
  InMemoryNotificationRepository,
  NOTIFICATION_REPOSITORY,
  type NotificationRepository,
} from './notification.repository';
import { PrismaNotificationRepository } from './prisma-notification.repository';
import { PrismaService } from './prisma.service';

export const NOTIFICATION_EMAIL_SENDER = Symbol('NOTIFICATION_EMAIL_SENDER');

function createRepositoryProvider() {
  const dbUrl =
    process.env['NOTIFICATION_DATABASE_URL'] ?? process.env['DATABASE_URL'];
  if (dbUrl) {
    return [
      PrismaService,
      {
        provide: NOTIFICATION_REPOSITORY,
        useFactory: (prisma: PrismaService): NotificationRepository =>
          new PrismaNotificationRepository(prisma),
        inject: [PrismaService],
      },
    ];
  }
  if (process.env['NODE_ENV'] === 'test') {
    return [
      {
        provide: NOTIFICATION_REPOSITORY,
        useClass: InMemoryNotificationRepository,
      },
    ];
  }
  throw new Error(
    'NOTIFICATION_DATABASE_URL bắt buộc khi chạy notification-service (trừ NODE_ENV=test)',
  );
}

function createEmailSenderProvider() {
  return {
    provide: NOTIFICATION_EMAIL_SENDER,
    useFactory: (): EmailSender => createEmailSender(),
  };
}

@Module({
  controllers: [NotificationsController, AdminNotificationsController],
  providers: [
    ...createRepositoryProvider(),
    createEmailSenderProvider(),
    {
      provide: NotificationService,
      useFactory: (
        repository: NotificationRepository,
        emailSender: EmailSender,
      ) => new NotificationService(repository, emailSender),
      inject: [NOTIFICATION_REPOSITORY, NOTIFICATION_EMAIL_SENDER],
    },
    {
      provide: EventConsumer,
      useFactory: (service: NotificationService) => new EventConsumer(service),
      inject: [NotificationService],
    },
  ],
})
export class NotificationModule {}
