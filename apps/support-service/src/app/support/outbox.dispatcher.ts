import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { createEventEnvelope, type EventType } from '@nexatech/shared-events';
import type { SupportEventPublisher } from './event-publisher';
import type { SupportRepository } from './support.repository';

@Injectable()
export class OutboxDispatcher implements OnModuleInit, OnModuleDestroy {
  private static readonly logger = new Logger(OutboxDispatcher.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly repository: SupportRepository,
    private readonly publisher: SupportEventPublisher,
  ) {}

  onModuleInit(): void {
    if (process.env['NODE_ENV'] === 'test') {
      return;
    }
    const intervalMs = Number(process.env['SUPPORT_OUTBOX_POLL_MS'] ?? 2000);
    this.timer = setInterval(() => {
      void this.flush().catch((error) => {
        OutboxDispatcher.logger.warn(`Outbox flush failed: ${String(error)}`);
      });
    }, intervalMs);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async flush(limit = 50): Promise<number> {
    const events = await this.repository.listUnpublishedOutbox(limit);
    const publishedIds: string[] = [];
    for (const event of events) {
      const envelope = createEventEnvelope({
        eventType: event.eventType as EventType,
        producer: 'support-service',
        traceId: event.traceId,
        payload: event.payload,
        eventId: event.id,
      });
      await this.publisher.publish(envelope);
      publishedIds.push(event.id);
    }
    if (publishedIds.length) {
      await this.repository.markOutboxPublished(publishedIds);
    }
    return publishedIds.length;
  }
}
