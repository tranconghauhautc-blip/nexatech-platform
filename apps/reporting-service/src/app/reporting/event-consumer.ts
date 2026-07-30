import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  EVENT_DLX,
  EVENT_EXCHANGE,
  EventTypes,
  RoutingKeys,
  type EventEnvelope,
  type EventType,
} from '@nexatech/shared-events';
import * as amqplib from 'amqplib';
import type { ReportingService } from './reporting.service';

export const REPORTING_QUEUE_NAME = 'reporting-service.events';

/** Toàn bộ eventType mà reporting-service tiêu thụ để cập nhật read model. */
export const CONSUMED_EVENT_TYPES: EventType[] = [
  EventTypes.ORDER_CREATED,
  EventTypes.ORDER_CONFIRMED,
  EventTypes.ORDER_STATUS_CHANGED,
  EventTypes.ORDER_CANCELLED,
  EventTypes.ORDER_SHIPPED,
  EventTypes.ORDER_DELIVERED,
  EventTypes.ORDER_RETURNED,
  EventTypes.ORDER_FAILED,
  EventTypes.PAYMENT_CREATED,
  EventTypes.PAYMENT_PENDING,
  EventTypes.PAYMENT_PROCESSING,
  EventTypes.PAYMENT_PAID,
  EventTypes.PAYMENT_SUCCEEDED,
  EventTypes.PAYMENT_FAILED,
  EventTypes.PAYMENT_CANCELLED,
  EventTypes.PAYMENT_EXPIRED,
  EventTypes.PAYMENT_REFUNDED,
  EventTypes.PAYMENT_PARTIALLY_REFUNDED,
  EventTypes.PAYMENT_REFUND_REQUESTED,
  EventTypes.SHIPMENT_CREATED,
  EventTypes.SHIPMENT_BOOKED,
  EventTypes.SHIPMENT_PICKED_UP,
  EventTypes.SHIPMENT_IN_TRANSIT,
  EventTypes.SHIPMENT_OUT_FOR_DELIVERY,
  EventTypes.SHIPMENT_DELIVERED,
  EventTypes.SHIPMENT_DELIVERY_FAILED,
  EventTypes.SHIPMENT_CANCELLED,
  EventTypes.SHIPMENT_RETURNED,
  EventTypes.SHIPMENT_TRACKING_UPDATED,
  EventTypes.REVIEW_CREATED,
  EventTypes.REVIEW_PUBLISHED,
  EventTypes.REVIEW_UPDATED,
  EventTypes.REVIEW_HIDDEN,
  EventTypes.REVIEW_REJECTED,
  EventTypes.REVIEW_DELETED,
  EventTypes.REVIEW_REPORT_RESOLVED,
  EventTypes.REVIEW_HELPFUL_ADDED,
  EventTypes.REVIEW_HELPFUL_REMOVED,
  EventTypes.WARRANTY_CLAIM_CREATED,
  EventTypes.WARRANTY_CLAIM_UPDATED,
  EventTypes.WARRANTY_CLAIM_APPROVED,
  EventTypes.WARRANTY_CLAIM_REJECTED,
  EventTypes.WARRANTY_CLAIM_COMPLETED,
  EventTypes.WARRANTY_CLAIM_CANCELLED,
  EventTypes.WARRANTY_RETURN_REQUESTED,
  EventTypes.WARRANTY_RETURN_UPDATED,
  EventTypes.WARRANTY_RETURN_APPROVED,
  EventTypes.WARRANTY_RETURN_REJECTED,
  EventTypes.WARRANTY_RETURN_COMPLETED,
  EventTypes.WARRANTY_RETURN_CANCELLED,
  EventTypes.SUPPORT_TICKET_CREATED,
  EventTypes.SUPPORT_TICKET_UPDATED,
  EventTypes.SUPPORT_TICKET_ASSIGNED,
  EventTypes.SUPPORT_TICKET_RESOLVED,
  EventTypes.SUPPORT_TICKET_CLOSED,
  EventTypes.SUPPORT_TICKET_CANCELLED,
  EventTypes.AUDIT_RECORDED,
];

/**
 * reporting-service là consumer RabbitMQ thứ hai trong hệ thống (sau
 * notification-service). Đăng ký queue durable, bind vào toàn bộ routing
 * key liên quan, và ack/nack theo kết quả xử lý — nack(requeue=false) để
 * tin nhắn lỗi rơi vào dead-letter exchange thay vì lặp vô hạn.
 */
@Injectable()
export class EventConsumer implements OnModuleInit, OnModuleDestroy {
  private static readonly logger = new Logger(EventConsumer.name);

  private connection: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;

  constructor(private readonly service: ReportingService) {}

  async onModuleInit(): Promise<void> {
    if (process.env['NODE_ENV'] === 'test') {
      return;
    }
    const url = process.env['RABBITMQ_URL'];
    if (!url) {
      EventConsumer.logger.warn(
        'RABBITMQ_URL chưa được cấu hình, bỏ qua khởi tạo consumer sự kiện',
      );
      return;
    }
    try {
      await this.start(url);
    } catch (error) {
      EventConsumer.logger.error(
        `Không thể khởi tạo consumer RabbitMQ: ${String(error)}`,
      );
    }
  }

  async start(url: string): Promise<void> {
    const connection = await amqplib.connect(url);
    const channel = await connection.createChannel();

    await channel.assertExchange(EVENT_EXCHANGE, 'topic', { durable: true });
    await channel.assertExchange(EVENT_DLX, 'topic', { durable: true });
    await channel.assertQueue(REPORTING_QUEUE_NAME, {
      durable: true,
      deadLetterExchange: EVENT_DLX,
    });

    for (const eventType of CONSUMED_EVENT_TYPES) {
      await channel.bindQueue(
        REPORTING_QUEUE_NAME,
        EVENT_EXCHANGE,
        RoutingKeys[eventType],
      );
    }

    const prefetch = Number(process.env['REPORTING_CONSUMER_PREFETCH'] ?? 10);
    await channel.prefetch(prefetch);

    await channel.consume(REPORTING_QUEUE_NAME, (msg) => {
      if (!msg) {
        return;
      }
      void this.handleMessage(channel, msg);
    });

    this.connection = connection;
    this.channel = channel;

    connection.on('close', () => {
      this.channel = null;
      this.connection = null;
    });
    connection.on('error', (error: unknown) => {
      EventConsumer.logger.warn(`Kết nối RabbitMQ gặp lỗi: ${String(error)}`);
    });

    EventConsumer.logger.log(
      `Đã kết nối RabbitMQ, lắng nghe queue "${REPORTING_QUEUE_NAME}"`,
    );
  }

  private async handleMessage(
    channel: amqplib.Channel,
    msg: amqplib.ConsumeMessage,
  ): Promise<void> {
    try {
      const envelope = JSON.parse(
        msg.content.toString('utf8'),
      ) as EventEnvelope;
      await this.processEvent(envelope);
      channel.ack(msg);
    } catch (error) {
      EventConsumer.logger.error(`Xử lý sự kiện thất bại: ${String(error)}`);
      channel.nack(msg, false, false);
    }
  }

  /** Cho phép gọi trực tiếp trong unit test mà không cần RabbitMQ. */
  async processEvent(envelope: EventEnvelope): Promise<void> {
    await this.service.processEventEnvelope(envelope);
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch {
      // ignore
    } finally {
      this.channel = null;
      this.connection = null;
    }
  }
}
