import { createEventEnvelope, EventTypes } from '@nexatech/shared-events';
import { createTraceId } from '@nexatech/shared-platform';
import { RabbitMqEventPublisher } from './event-publisher';

const describeIfRabbit = process.env['RABBITMQ_URL'] ? describe : describe.skip;

describeIfRabbit('RabbitMqEventPublisher smoke', () => {
  it('publishes an event to the topic exchange without throwing', async () => {
    const publisher = new RabbitMqEventPublisher(
      process.env['RABBITMQ_URL'] as string,
    );
    await publisher.publish(
      createEventEnvelope({
        eventType: EventTypes.INVENTORY_LOW_STOCK_DETECTED,
        producer: 'inventory-service-test',
        traceId: createTraceId(),
        payload: { skuCode: 'SMOKE-TEST' },
      }),
    );
    expect(publisher.published).toHaveLength(1);
    await publisher.close();
  });
});
