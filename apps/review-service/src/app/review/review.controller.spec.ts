import { parseActor, ReviewService } from './review.service';
import { ReviewsController } from './review.controller';
import { InMemoryReviewRepository } from './review.repository';
import { InMemoryOrderClient } from './order.client';
import { InMemoryCatalogClient } from './catalog.client';
import { InMemoryMediaClient } from './media.client';
import { InMemoryEventPublisher } from './event-publisher';

describe('ReviewsController', () => {
  it('delegates create to service with parsed actor', async () => {
    const repository = new InMemoryReviewRepository();
    const orders = new InMemoryOrderClient();
    const catalog = new InMemoryCatalogClient();
    const media = new InMemoryMediaClient();
    const publisher = new InMemoryEventPublisher();
    catalog.seed({ id: 'prod-1', name: 'P', status: 'active' });
    orders.seed({
      id: 'ord-1',
      orderCode: 'NT-1',
      customerId: 'cust-1',
      status: 'DELIVERED',
      items: [
        {
          id: 'oi-1',
          skuId: 's1',
          skuCode: 'S1',
          productId: 'prod-1',
          productName: 'P',
        },
      ],
      packages: [
        { id: 'pkg-1', status: 'DELIVERED', items: [{ orderItemId: 'oi-1' }] },
      ],
    });
    const service = new ReviewService(
      repository,
      orders,
      catalog,
      media,
      publisher,
    );
    const controller = new ReviewsController(service);
    const result = await controller.create('cust-1', 'Customer', undefined, {
      orderId: 'ord-1',
      orderItemId: 'oi-1',
      rating: 5,
      content: 'Controller tạo review thành công.',
    });
    expect(result.productId).toBe('prod-1');
    expect(parseActor('cust-1', 'Customer').userId).toBe('cust-1');
  });
});
