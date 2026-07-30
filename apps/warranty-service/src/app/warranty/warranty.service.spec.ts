import { ErrorCodes } from '@nexatech/shared-errors';
import { EventTypes } from '@nexatech/shared-events';
import { InMemoryEventPublisher } from './event-publisher';
import { InMemoryMediaClient } from './media.client';
import { InMemoryOrderClient } from './order.client';
import { InMemoryWarrantyRepository } from './warranty.repository';
import { parseActor, WarrantyService } from './warranty.service';
import type { OrderSnapshot } from './warranty.types';

describe('WarrantyService', () => {
  let repository: InMemoryWarrantyRepository;
  let orders: InMemoryOrderClient;
  let media: InMemoryMediaClient;
  let publisher: InMemoryEventPublisher;
  let service: WarrantyService;

  const customer = parseActor('cust-1', 'Customer');
  const other = parseActor('cust-2', 'Customer');
  const staff = parseActor('staff-1', 'Staff');

  function seedDeliveredOrder(
    overrides: Partial<OrderSnapshot> = {},
  ): OrderSnapshot {
    const order: OrderSnapshot = {
      id: 'ord-1',
      orderCode: 'NT-20260730-000001',
      customerId: 'cust-1',
      status: 'DELIVERED',
      items: [
        {
          id: 'oi-1',
          skuId: 'sku-1',
          skuCode: 'PHONE-1',
          productId: 'prod-1',
          productName: 'Phone X',
          quantity: 2,
        },
      ],
      packages: [
        {
          id: 'pkg-1',
          status: 'DELIVERED',
          items: [{ orderItemId: 'oi-1' }],
        },
      ],
      ...overrides,
    };
    orders.seed(order);
    return order;
  }

  beforeEach(() => {
    process.env['NODE_ENV'] = 'test';
    repository = new InMemoryWarrantyRepository();
    orders = new InMemoryOrderClient();
    media = new InMemoryMediaClient();
    publisher = new InMemoryEventPublisher();
    media.seed({
      id: 'media-1',
      uploadedBy: 'cust-1',
      mimeType: 'image/jpeg',
      status: 'active',
    });
    service = new WarrantyService(repository, orders, media, publisher);
    seedDeliveredOrder();
  });

  describe('warranty claims', () => {
    it('creates a claim for verified buyer and publishes event', async () => {
      const claim = await service.createWarrantyClaim(customer, {
        orderId: 'ord-1',
        orderItemId: 'oi-1',
        issueType: 'DEFECT',
        description: 'Sản phẩm bị lỗi màn hình sau 2 tuần sử dụng.',
      });
      expect(claim.status).toBe('SUBMITTED');
      expect(claim.productId).toBe('prod-1');
      expect(claim.customerId).toBe('cust-1');

      const events = publisher.published.map((e) => e.eventType);
      expect(events).toContain(EventTypes.WARRANTY_CLAIM_CREATED);
    });

    it('rejects non-buyer and undelivered orders', async () => {
      await expect(
        service.createWarrantyClaim(other, {
          orderId: 'ord-1',
          orderItemId: 'oi-1',
          issueType: 'DEFECT',
          description: 'Người khác không mua đơn này.',
        }),
      ).rejects.toMatchObject({
        errorCode: ErrorCodes.WARRANTY_NOT_VERIFIED_BUYER,
      });

      seedDeliveredOrder({ status: 'SHIPPED', packages: [] });
      await expect(
        service.createWarrantyClaim(customer, {
          orderId: 'ord-1',
          orderItemId: 'oi-1',
          issueType: 'DEFECT',
          description: 'Đơn hàng chưa giao xong.',
        }),
      ).rejects.toMatchObject({
        errorCode: ErrorCodes.WARRANTY_ORDER_NOT_DELIVERED,
      });
    });

    it('rejects duplicate active claim for same order item', async () => {
      await service.createWarrantyClaim(customer, {
        orderId: 'ord-1',
        orderItemId: 'oi-1',
        issueType: 'DEFECT',
        description: 'Sản phẩm bị lỗi màn hình sau 2 tuần sử dụng.',
      });
      await expect(
        service.createWarrantyClaim(customer, {
          orderId: 'ord-1',
          orderItemId: 'oi-1',
          issueType: 'MALFUNCTION',
          description: 'Yêu cầu bảo hành lần hai cho cùng sản phẩm.',
        }),
      ).rejects.toMatchObject({
        errorCode: ErrorCodes.WARRANTY_ALREADY_EXISTS,
      });
    });

    it('validates media ownership, mime type and limits', async () => {
      media.seed({
        id: 'media-other',
        uploadedBy: 'cust-2',
        mimeType: 'image/png',
        status: 'active',
      });
      await expect(
        service.createWarrantyClaim(customer, {
          orderId: 'ord-1',
          orderItemId: 'oi-1',
          issueType: 'DEFECT',
          description: 'Gắn media của người khác vào yêu cầu.',
          mediaIds: ['media-other'],
        }),
      ).rejects.toMatchObject({
        errorCode: ErrorCodes.WARRANTY_MEDIA_FORBIDDEN,
      });

      media.seed({
        id: 'media-video',
        uploadedBy: 'cust-1',
        mimeType: 'video/mp4',
        status: 'active',
      });
      await expect(
        service.createWarrantyClaim(customer, {
          orderId: 'ord-1',
          orderItemId: 'oi-1',
          issueType: 'DEFECT',
          description: 'Đính kèm video không hợp lệ.',
          mediaIds: ['media-video'],
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCodes.WARRANTY_MEDIA_INVALID });

      const claim = await service.createWarrantyClaim(customer, {
        orderId: 'ord-1',
        orderItemId: 'oi-1',
        issueType: 'DEFECT',
        description: 'Có một ảnh hợp lệ kèm theo.',
        mediaIds: ['media-1'],
      });
      expect(claim.media).toHaveLength(1);

      for (let i = 2; i <= 5; i += 1) {
        media.seed({
          id: `media-${i}`,
          uploadedBy: 'cust-1',
          mimeType: 'image/jpeg',
          status: 'active',
        });
        await service.attachClaimMedia(customer, claim.id, {
          mediaId: `media-${i}`,
        });
      }
      media.seed({
        id: 'media-6',
        uploadedBy: 'cust-1',
        mimeType: 'image/jpeg',
        status: 'active',
      });
      await expect(
        service.attachClaimMedia(customer, claim.id, { mediaId: 'media-6' }),
      ).rejects.toMatchObject({ errorCode: ErrorCodes.WARRANTY_MEDIA_LIMIT });
    });

    it('walks through claim lifecycle transitions with staff', async () => {
      const claim = await service.createWarrantyClaim(customer, {
        orderId: 'ord-1',
        orderItemId: 'oi-1',
        issueType: 'DEFECT',
        description: 'Sản phẩm bị lỗi màn hình sau 2 tuần sử dụng.',
      });

      await expect(
        service.adminTransitionClaim(customer, claim.id, {
          action: 'start_review',
        }),
      ).rejects.toMatchObject({ errorCode: ErrorCodes.FORBIDDEN });

      const reviewing = await service.adminTransitionClaim(staff, claim.id, {
        action: 'start_review',
      });
      expect(reviewing.status).toBe('UNDER_REVIEW');

      const approved = await service.adminTransitionClaim(staff, claim.id, {
        action: 'approve',
      });
      expect(approved.status).toBe('APPROVED');
      const events1 = publisher.published.map((e) => e.eventType);
      expect(events1).toContain(EventTypes.WARRANTY_CLAIM_APPROVED);

      const repairing = await service.adminTransitionClaim(staff, claim.id, {
        action: 'start_repair',
      });
      expect(repairing.status).toBe('IN_PROGRESS');

      const completed = await service.adminTransitionClaim(staff, claim.id, {
        action: 'complete',
      });
      expect(completed.status).toBe('COMPLETED');
      const events2 = publisher.published.map((e) => e.eventType);
      expect(events2).toContain(EventTypes.WARRANTY_CLAIM_COMPLETED);

      await expect(
        service.adminTransitionClaim(staff, claim.id, { action: 'cancel' }),
      ).rejects.toMatchObject({
        errorCode: ErrorCodes.WARRANTY_INVALID_TRANSITION,
      });
    });

    it('allows customer to cancel own claim and rotates active key', async () => {
      const claim = await service.createWarrantyClaim(customer, {
        orderId: 'ord-1',
        orderItemId: 'oi-1',
        issueType: 'DEFECT',
        description: 'Sản phẩm bị lỗi màn hình sau 2 tuần sử dụng.',
      });
      const cancelled = await service.cancelClaim(customer, claim.id, {
        reason: 'Không cần bảo hành nữa',
      });
      expect(cancelled.status).toBe('CANCELLED');

      const again = await service.createWarrantyClaim(customer, {
        orderId: 'ord-1',
        orderItemId: 'oi-1',
        issueType: 'MALFUNCTION',
        description: 'Yêu cầu bảo hành mới sau khi đã hủy trước đó.',
      });
      expect(again.status).toBe('SUBMITTED');

      await expect(
        service.cancelClaim(other, again.id, {}),
      ).rejects.toMatchObject({ errorCode: ErrorCodes.WARRANTY_FORBIDDEN });
    });
  });

  describe('return requests', () => {
    it('creates a return request for verified buyer and publishes event', async () => {
      const ret = await service.createReturnRequest(customer, {
        orderId: 'ord-1',
        orderItemId: 'oi-1',
        reason: 'CHANGED_MIND',
        description: 'Không còn nhu cầu sử dụng sản phẩm nữa.',
        quantity: 1,
      });
      expect(ret.status).toBe('REQUESTED');
      expect(ret.desiredResolution).toBe('REFUND');

      const events = publisher.published.map((e) => e.eventType);
      expect(events).toContain(EventTypes.WARRANTY_RETURN_REQUESTED);
    });

    it('validates quantity against purchased amount', async () => {
      await expect(
        service.createReturnRequest(customer, {
          orderId: 'ord-1',
          orderItemId: 'oi-1',
          reason: 'CHANGED_MIND',
          description: 'Số lượng vượt quá số lượng đã mua.',
          quantity: 5,
        }),
      ).rejects.toMatchObject({
        errorCode: ErrorCodes.WARRANTY_QUANTITY_INVALID,
      });
    });

    it('rejects duplicate active return for same order item', async () => {
      await service.createReturnRequest(customer, {
        orderId: 'ord-1',
        orderItemId: 'oi-1',
        reason: 'CHANGED_MIND',
        description: 'Không còn nhu cầu sử dụng sản phẩm nữa.',
      });
      await expect(
        service.createReturnRequest(customer, {
          orderId: 'ord-1',
          orderItemId: 'oi-1',
          reason: 'DEFECTIVE',
          description: 'Yêu cầu đổi trả lần hai cho cùng sản phẩm.',
        }),
      ).rejects.toMatchObject({
        errorCode: ErrorCodes.WARRANTY_ALREADY_EXISTS,
      });
    });

    it('syncs order status on approve/complete and skips duplicate sync', async () => {
      const ret = await service.createReturnRequest(customer, {
        orderId: 'ord-1',
        orderItemId: 'oi-1',
        reason: 'DEFECTIVE',
        description: 'Sản phẩm lỗi cần đổi trả toàn bộ.',
      });
      await service.adminTransitionReturn(staff, ret.id, {
        action: 'start_review',
      });
      const approved = await service.adminTransitionReturn(staff, ret.id, {
        action: 'approve',
      });
      expect(approved.orderSyncedStatus).toBe('RETURN_REQUESTED');
      expect(orders.syncCalls).toHaveLength(1);

      const awaiting = await service.adminTransitionReturn(staff, ret.id, {
        action: 'mark_awaiting_return',
      });
      expect(awaiting.status).toBe('AWAITING_RETURN');
      // No order sync target for awaiting_return -> no extra call
      expect(orders.syncCalls).toHaveLength(1);

      const received = await service.adminTransitionReturn(staff, ret.id, {
        action: 'mark_received',
      });
      expect(received.status).toBe('RECEIVED');

      const completed = await service.adminTransitionReturn(staff, ret.id, {
        action: 'complete',
      });
      expect(completed.status).toBe('COMPLETED');
      expect(completed.orderSyncedStatus).toBe('RETURNED');
      expect(orders.syncCalls).toHaveLength(2);

      const events = publisher.published.map((e) => e.eventType);
      // mark_received should request inventory return event only (no HTTP call)
      expect(events).toContain(EventTypes.WARRANTY_INVENTORY_RETURN_REQUESTED);
      // complete with REFUND resolution should request refund event only (no HTTP call)
      expect(events).toContain(EventTypes.WARRANTY_REFUND_REQUESTED);
    });

    it('reverts order sync to DELIVERED when rejected after approval', async () => {
      const ret = await service.createReturnRequest(customer, {
        orderId: 'ord-1',
        orderItemId: 'oi-1',
        reason: 'DEFECTIVE',
        description: 'Sản phẩm lỗi cần đổi trả toàn bộ.',
      });
      await service.adminTransitionReturn(staff, ret.id, {
        action: 'start_review',
      });
      await service.adminTransitionReturn(staff, ret.id, {
        action: 'approve',
      });
      expect(orders.syncCalls).toHaveLength(1);

      // Approve -> awaiting_return -> received then reject is not valid, so
      // instead cancel from AWAITING_RETURN to verify reverse sync.
      await service.adminTransitionReturn(staff, ret.id, {
        action: 'mark_awaiting_return',
      });
      const cancelled = await service.adminTransitionReturn(staff, ret.id, {
        action: 'cancel',
      });
      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.orderSyncedStatus).toBe('DELIVERED');
      expect(orders.syncCalls).toHaveLength(2);
    });

    it('does not sync order again with an unchanged idempotency key result', async () => {
      const ret = await service.createReturnRequest(customer, {
        orderId: 'ord-1',
        orderItemId: 'oi-1',
        reason: 'DEFECTIVE',
        description: 'Sản phẩm lỗi cần đổi trả toàn bộ.',
        idempotencyKey: 'create-return-1',
      });
      const again = await service.createReturnRequest(customer, {
        orderId: 'ord-1',
        orderItemId: 'oi-1',
        reason: 'DEFECTIVE',
        description: 'Sản phẩm lỗi cần đổi trả toàn bộ.',
        idempotencyKey: 'create-return-1',
      });
      expect(again.id).toBe(ret.id);

      await service.adminTransitionReturn(staff, ret.id, {
        action: 'start_review',
      });
      await service.adminTransitionReturn(staff, ret.id, {
        action: 'approve',
        idempotencyKey: 'approve-1',
      });
      expect(orders.syncCalls).toHaveLength(1);

      // Repeat with same idempotencyKey returns cached response, no new
      // transition or extra order sync call.
      const repeated = await service.adminTransitionReturn(staff, ret.id, {
        action: 'approve',
        idempotencyKey: 'approve-1',
      });
      expect(repeated.status).toBe('APPROVED');
      expect(orders.syncCalls).toHaveLength(1);
    });

    it('propagates order sync failure without persisting local change', async () => {
      const ret = await service.createReturnRequest(customer, {
        orderId: 'ord-1',
        orderItemId: 'oi-1',
        reason: 'DEFECTIVE',
        description: 'Sản phẩm lỗi cần đổi trả toàn bộ.',
      });
      await service.adminTransitionReturn(staff, ret.id, {
        action: 'start_review',
      });
      orders.failSyncOnce = true;
      await expect(
        service.adminTransitionReturn(staff, ret.id, { action: 'approve' }),
      ).rejects.toMatchObject({
        errorCode: ErrorCodes.WARRANTY_ORDER_SYNC_FAILED,
      });
      const current = await service.getReturn(staff, ret.id);
      expect(current.status).toBe('UNDER_REVIEW');
    });

    it('allows customer to cancel own return and rotates active key', async () => {
      const ret = await service.createReturnRequest(customer, {
        orderId: 'ord-1',
        orderItemId: 'oi-1',
        reason: 'CHANGED_MIND',
        description: 'Không còn nhu cầu sử dụng sản phẩm nữa.',
      });
      const cancelled = await service.cancelReturn(customer, ret.id, {});
      expect(cancelled.status).toBe('CANCELLED');

      const again = await service.createReturnRequest(customer, {
        orderId: 'ord-1',
        orderItemId: 'oi-1',
        reason: 'DEFECTIVE',
        description: 'Yêu cầu đổi trả mới sau khi đã hủy trước đó.',
      });
      expect(again.status).toBe('REQUESTED');
    });
  });

  describe('admin RBAC', () => {
    it('enforces staff-only access on admin endpoints', async () => {
      const claim = await service.createWarrantyClaim(customer, {
        orderId: 'ord-1',
        orderItemId: 'oi-1',
        issueType: 'DEFECT',
        description: 'Sản phẩm bị lỗi màn hình sau 2 tuần sử dụng.',
      });
      await expect(service.adminListClaims(customer, {})).rejects.toMatchObject(
        { errorCode: ErrorCodes.FORBIDDEN },
      );

      const list = await service.adminListClaims(staff, {});
      expect(list.items.length).toBeGreaterThanOrEqual(1);

      const detail = await service.adminGetClaim(staff, claim.id);
      expect(detail.history.length).toBeGreaterThanOrEqual(1);
    });
  });
});
