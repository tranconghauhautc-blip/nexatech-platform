import { Logger } from '@nestjs/common';
import {
  EVENT_EXCHANGE,
  routingKeyFor,
  type EventEnvelope,
} from '@nexatech/shared-events';
import * as amqplib from 'amqplib';

export interface ShippingEventPublisher {
  publish(envelope: EventEnvelope): Promise<void>;
  readonly published: EventEnvelope[];
}

export class InMemoryEventPublisher implements ShippingEventPublisher {
  readonly published: EventEnvelope[] = [];

  async publish(envelope: EventEnvelope): Promise<void> {
    this.published.push(envelope);
  }
}

export class RabbitMqEventPublisher implements ShippingEventPublisher {
  private static readonly logger = new Logger(RabbitMqEventPublisher.name);
  readonly published: EventEnvelope[] = [];

  private connection: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;
  private connecting: Promise<amqplib.Channel> | null = null;

  constructor(
    private readonly url: string,
    private readonly exchange: string = EVENT_EXCHANGE,
  ) {}

  private async getChannel(): Promise<amqplib.Channel> {
    if (this.channel) {
      return this.channel;
    }
    if (!this.connecting) {
      this.connecting = this.connect();
    }
    return this.connecting;
  }

  private async connect(): Promise<amqplib.Channel> {
    const connection = await amqplib.connect(this.url);
    const channel = await connection.createChannel();
    await channel.assertExchange(this.exchange, 'topic', { durable: true });
    this.connection = connection;
    this.channel = channel;
    connection.on('close', () => {
      this.channel = null;
      this.connection = null;
      this.connecting = null;
    });
    connection.on('error', (error: unknown) => {
      RabbitMqEventPublisher.logger.warn(
        `Kết nối RabbitMQ gặp lỗi: ${String(error)}`,
      );
    });
    return channel;
  }

  async publish(envelope: EventEnvelope): Promise<void> {
    this.published.push(envelope);
    const channel = await this.getChannel();
    const routingKey = routingKeyFor(envelope.eventType);
    channel.publish(
      this.exchange,
      routingKey,
      Buffer.from(JSON.stringify(envelope)),
      { persistent: true, contentType: 'application/json' },
    );
  }

  async close(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch {
      // ignore shutdown errors
    } finally {
      this.channel = null;
      this.connection = null;
      this.connecting = null;
    }
  }
}
