import { AdminWarrantyController } from './admin-warranty.controller';
import { ClaimsController } from './claims.controller';
import { InMemoryEventPublisher } from './event-publisher';
import { InMemoryMediaClient } from './media.client';
import { InMemoryOrderClient } from './order.client';
import { ReturnsController } from './returns.controller';
import { InMemoryWarrantyRepository } from './warranty.repository';
import { parseActor, WarrantyService } from './warranty.service';

function buildService() {
  const repository = new InMemoryWarrantyRepository();
  const orders = new InMemoryOrderClient();
  const media = new InMemoryMediaClient();
  const publisher = new InMemoryEventPublisher();
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
        productName: 'Điện thoại X',
        quantity: 1,
      },
    ],
    packages: [
      { id: 'pkg-1', status: 'DELIVERED', items: [{ orderItemId: 'oi-1' }] },
    ],
  });
  const service = new WarrantyService(repository, orders, media, publisher);
  return { service, repository, orders, media, publisher };
}

describe('ClaimsController', () => {
  it('delegates create to service with parsed actor', async () => {
    const { service } = buildService();
    const controller = new ClaimsController(service);
    const result = await controller.create('cust-1', 'Customer', undefined, {
      orderId: 'ord-1',
      orderItemId: 'oi-1',
      issueType: 'DEFECT',
      description: 'Sản phẩm bị lỗi màn hình sau 2 tuần sử dụng.',
    });
    expect(result.productId).toBe('prod-1');
    expect(result.status).toBe('SUBMITTED');
    expect(parseActor('cust-1', 'Customer').userId).toBe('cust-1');
  });

  it('lists my claims', async () => {
    const { service } = buildService();
    const controller = new ClaimsController(service);
    await controller.create('cust-1', 'Customer', undefined, {
      orderId: 'ord-1',
      orderItemId: 'oi-1',
      issueType: 'DEFECT',
      description: 'Sản phẩm bị lỗi màn hình sau 2 tuần sử dụng.',
    });
    const list = await controller.list('cust-1', 'Customer', {});
    expect(list.items).toHaveLength(1);
  });
});

describe('ReturnsController', () => {
  it('delegates create to service with parsed actor', async () => {
    const { service } = buildService();
    const controller = new ReturnsController(service);
    const result = await controller.create('cust-1', 'Customer', undefined, {
      orderId: 'ord-1',
      orderItemId: 'oi-1',
      reason: 'CHANGED_MIND',
      description: 'Không còn nhu cầu sử dụng sản phẩm nữa.',
    });
    expect(result.productId).toBe('prod-1');
    expect(result.status).toBe('REQUESTED');
  });
});

describe('AdminWarrantyController', () => {
  it('lists claims for staff', async () => {
    const { service } = buildService();
    const claimsController = new ClaimsController(service);
    const adminController = new AdminWarrantyController(service);
    await claimsController.create('cust-1', 'Customer', undefined, {
      orderId: 'ord-1',
      orderItemId: 'oi-1',
      issueType: 'DEFECT',
      description: 'Sản phẩm bị lỗi màn hình sau 2 tuần sử dụng.',
    });
    const result = await adminController.listClaims('staff-1', 'Staff', {});
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.customerId).toBe('cust-1');
  });
});
