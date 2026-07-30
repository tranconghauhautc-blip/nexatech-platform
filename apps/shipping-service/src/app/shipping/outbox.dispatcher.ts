import { Logger } from '@nestjs/common';
import { createEventEnvelope, type EventType } from '@nexatech/shared-events';
import type { ShippingRepository } from './shipping.repository';
import type { ShippingEventPublisher } from './event-publisher';

const DEFAULT_BATCH_SIZE = 50;

export class OutboxDispatcher {
  private static readonly logger = new Logger(OutboxDispatcher.name);

  constructor(
    private readonly repository: ShippingRepository,
    private readonly publisher: ShippingEventPublisher,
  ) {}

  async dispatchPending(limit: number = DEFAULT_BATCH_SIZE): Promise<number> {
    const events = await this.repository.listUnpublishedOutbox(limit);
    let dispatched = 0;
    for (const event of events) {
      try {
        await this.publisher.publish(
          createEventEnvelope({
            eventType: event.eventType as EventType,
            producer: 'shipping-service',
            traceId: event.traceId,
            payload: event.payload as Record<string, unknown>,
          }),
        );
        await this.repository.markOutboxPublished([event.id]);
        dispatched += 1;
      } catch (error) {
        OutboxDispatcher.logger.warn(
          `Không thể publish outbox event ${event.eventType} (${event.id}): ${String(error)}`,
        );
      }
    }
    return dispatched;
  }
}
