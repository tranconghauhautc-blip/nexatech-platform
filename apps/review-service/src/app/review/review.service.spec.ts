import { EventTypes } from '@nexatech/shared-events';
import { ErrorCodes } from '@nexatech/shared-errors';
import { InMemoryCatalogClient } from './catalog.client';
import { InMemoryEventPublisher } from './event-publisher';
import { InMemoryMediaClient } from './media.client';
import { InMemoryOrderClient } from './order.client';
import { InMemoryReviewRepository } from './review.repository';
import { parseActor, ReviewService } from './review.service';
import type { OrderSnapshot } from './review.types';

describe('ReviewService', () => {
  let repository: InMemoryReviewRepository;
  let orders: InMemoryOrderClient;
  let catalog: InMemoryCatalogClient;
  let media: InMemoryMediaClient;
  let publisher: InMemoryEventPublisher;
  let service: ReviewService;

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
        },
      ],
      packages: [
        {
          id: 'pkg-1',
          status: 'DELIVERED',
          items: [{ orderItemId: 'oi-1' }],
        },
      ],
      customerSnapshot: { displayName: 'Nguyễn Văn A' },
      ...overrides,
    };
    orders.seed(order);
    return order;
  }

  beforeEach(() => {
    process.env['NODE_ENV'] = 'test';
    process.env['REVIEW_AUTO_PUBLISH'] = 'true';
    repository = new InMemoryReviewRepository();
    orders = new InMemoryOrderClient();
    catalog = new InMemoryCatalogClient();
    media = new InMemoryMediaClient();
    publisher = new InMemoryEventPublisher();
    catalog.seed({ id: 'prod-1', name: 'Phone X', status: 'active' });
    media.seed({
      id: 'media-1',
      uploadedBy: 'cust-1',
      mimeType: 'image/jpeg',
      status: 'active',
    });
    service = new ReviewService(repository, orders, catalog, media, publisher);
    seedDeliveredOrder();
  });

  it('creates verified buyer review and updates aggregate', async () => {
    const review = await service.createReview(customer, {
      orderId: 'ord-1',
      orderItemId: 'oi-1',
      rating: 5,
      content: 'Sản phẩm rất tốt, giao hàng nhanh.',
      title: 'Tuyệt vời',
    });
    expect(review.verifiedPurchase).toBe(true);
    expect(review.status).toBe('PUBLISHED');
    expect(review.customerId).toBe('cust-1');
    expect(review.displayName).toBe('Nguyễn ***');
    expect(review.content).not.toContain('<');

    const summary = await service.getProductSummary('prod-1');
    expect(summary.totalReviews).toBe(1);
    expect(summary.averageRating).toBe(5);
    expect(summary.ratingCounts.star5).toBe(1);

    const events = publisher.published.map((e) => e.eventType);
    expect(events).toContain(EventTypes.REVIEW_CREATED);
    expect(events).toContain(EventTypes.REVIEW_PUBLISHED);
    expect(events).toContain(EventTypes.REVIEW_RATING_AGGREGATE_UPDATED);
  });

  it('rejects non-buyer and undelivered orders', async () => {
    await expect(
      service.createReview(other, {
        orderId: 'ord-1',
        orderItemId: 'oi-1',
        rating: 4,
        content: 'Tôi không mua nhưng vẫn muốn đánh giá.',
      }),
    ).rejects.toMatchObject({
      errorCode: ErrorCodes.REVIEW_NOT_VERIFIED_BUYER,
    });

    seedDeliveredOrder({ status: 'SHIPPED', packages: [] });
    await expect(
      service.createReview(customer, {
        orderId: 'ord-1',
        orderItemId: 'oi-1',
        rating: 4,
        content: 'Đơn chưa giao xong vẫn đánh giá.',
      }),
    ).rejects.toMatchObject({
      errorCode: ErrorCodes.REVIEW_ORDER_NOT_DELIVERED,
    });
  });

  it('enforces ownership, duplicates and rating/content validation', async () => {
    await service.createReview(customer, {
      orderId: 'ord-1',
      orderItemId: 'oi-1',
      rating: 5,
      content: 'Nội dung hợp lệ đủ dài.',
    });
    await expect(
      service.createReview(customer, {
        orderId: 'ord-1',
        orderItemId: 'oi-1',
        rating: 4,
        content: 'Đánh giá lần hai không được phép.',
      }),
    ).rejects.toMatchObject({ errorCode: ErrorCodes.REVIEW_ALREADY_EXISTS });

    await expect(
      service.createReview(customer, {
        orderId: 'ord-1',
        orderItemId: 'oi-1',
        rating: 9,
        content: 'Rating không hợp lệ nhưng nội dung ok.',
      }),
    ).rejects.toThrow();

    const listed = await service.listProductReviews('prod-1', {});
    expect(listed.items).toHaveLength(1);
    expect(listed.items[0].customerId).toBeUndefined();
  });

  it('edits review and updates aggregate rating', async () => {
    const created = await service.createReview(customer, {
      orderId: 'ord-1',
      orderItemId: 'oi-1',
      rating: 5,
      content: 'Ban đầu năm sao rất hài lòng.',
    });
    const updated = await service.updateReview(customer, created.id, {
      rating: 3,
      content: 'Sau vài ngày hạ xuống ba sao.',
      expectedVersion: created.version,
    });
    expect(updated.rating).toBe(3);
    expect(updated.editedAt).toBeTruthy();

    await expect(
      service.updateReview(other, created.id, {
        rating: 1,
        content: 'Người khác không được sửa.',
      }),
    ).rejects.toMatchObject({ errorCode: ErrorCodes.REVIEW_FORBIDDEN });

    const summary = await service.getProductSummary('prod-1');
    expect(summary.averageRating).toBe(3);
    expect(summary.ratingCounts.star5).toBe(0);
    expect(summary.ratingCounts.star3).toBe(1);
  });

  it('soft deletes review and adjusts aggregate', async () => {
    const created = await service.createReview(customer, {
      orderId: 'ord-1',
      orderItemId: 'oi-1',
      rating: 4,
      content: 'Sẽ xóa đánh giá này sau.',
    });
    await service.deleteReview(customer, created.id);
    const summary = await service.getProductSummary('prod-1');
    expect(summary.totalReviews).toBe(0);

    const again = await service.createReview(customer, {
      orderId: 'ord-1',
      orderItemId: 'oi-1',
      rating: 5,
      content: 'Đánh giá lại sau khi xóa trước đó.',
    });
    expect(again.rating).toBe(5);
  });

  it('validates media ownership and limits', async () => {
    media.seed({
      id: 'media-other',
      uploadedBy: 'cust-2',
      mimeType: 'image/png',
      status: 'active',
    });
    await expect(
      service.createReview(customer, {
        orderId: 'ord-1',
        orderItemId: 'oi-1',
        rating: 5,
        content: 'Gắn media của người khác.',
        mediaIds: ['media-other'],
      }),
    ).rejects.toMatchObject({ errorCode: ErrorCodes.REVIEW_MEDIA_FORBIDDEN });

    const created = await service.createReview(customer, {
      orderId: 'ord-1',
      orderItemId: 'oi-1',
      rating: 5,
      content: 'Có một ảnh hợp lệ kèm theo.',
      mediaIds: ['media-1'],
    });
    expect(created.hasMedia).toBe(true);
    expect(created.media).toHaveLength(1);

    for (let i = 2; i <= 5; i += 1) {
      media.seed({
        id: `media-${i}`,
        uploadedBy: 'cust-1',
        mimeType: 'image/jpeg',
        status: 'active',
      });
      await service.attachMedia(customer, created.id, {
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
      service.attachMedia(customer, created.id, { mediaId: 'media-6' }),
    ).rejects.toMatchObject({ errorCode: ErrorCodes.REVIEW_MEDIA_LIMIT });
  });

  it('allows staff reply and rejects unauthorized reply', async () => {
    const created = await service.createReview(customer, {
      orderId: 'ord-1',
      orderItemId: 'oi-1',
      rating: 4,
      content: 'Cần phản hồi từ cửa hàng.',
    });
    await expect(
      service.createReply(customer, created.id, {
        content: 'Khách không được reply.',
      }),
    ).rejects.toMatchObject({ errorCode: ErrorCodes.FORBIDDEN });

    const reply = await service.createReply(staff, created.id, {
      content: 'Cảm ơn bạn đã góp ý.',
    });
    expect(reply.staffId).toBe('staff-1');

    await expect(
      service.createReply(staff, created.id, {
        content: 'Reply thứ hai không được.',
      }),
    ).rejects.toMatchObject({ errorCode: ErrorCodes.REVIEW_REPLY_EXISTS });
  });

  it('handles helpful votes idempotently and concurrently', async () => {
    const created = await service.createReview(customer, {
      orderId: 'ord-1',
      orderItemId: 'oi-1',
      rating: 5,
      content: 'Review hữu ích để vote.',
    });
    await expect(
      service.addHelpful(customer, created.id),
    ).rejects.toMatchObject({
      errorCode: ErrorCodes.REVIEW_SELF_VOTE_FORBIDDEN,
    });

    const first = await service.addHelpful(other, created.id);
    const second = await service.addHelpful(other, created.id);
    expect(first.helpfulCount).toBe(1);
    expect(second.helpfulCount).toBe(1);

    const voters = Array.from({ length: 10 }, (_, i) =>
      parseActor(`voter-${i}`, 'Customer'),
    );
    await Promise.all(voters.map((v) => service.addHelpful(v, created.id)));
    const after = await service.getReview(staff, created.id);
    expect(after.helpfulCount).toBe(11);

    await service.removeHelpful(other, created.id);
    await service.removeHelpful(other, created.id);
    const removed = await service.getReview(staff, created.id);
    expect(removed.helpfulCount).toBe(10);
  });

  it('rejects duplicate reports and supports moderation transitions', async () => {
    process.env['REVIEW_AUTO_PUBLISH'] = 'false';
    const created = await service.createReview(customer, {
      orderId: 'ord-1',
      orderItemId: 'oi-1',
      rating: 2,
      content: 'Đánh giá chờ kiểm duyệt.',
    });
    expect(created.status).toBe('PENDING');

    const published = await service.moderate(staff, created.id, {
      action: 'publish',
      reason: 'Nội dung hợp lệ',
    });
    expect(published.status).toBe('PUBLISHED');

    const report = await service.reportReview(other, created.id, {
      reason: 'SPAM',
      description: 'Nghi spam',
    });
    await expect(
      service.reportReview(other, created.id, { reason: 'SPAM' }),
    ).rejects.toMatchObject({ errorCode: ErrorCodes.REVIEW_REPORT_DUPLICATE });

    const hidden = await service.moderate(staff, created.id, {
      action: 'hide',
      reason: 'Vi phạm sau báo cáo',
    });
    expect(hidden.status).toBe('HIDDEN');
    expect((await service.getProductSummary('prod-1')).totalReviews).toBe(0);

    await service.resolveReport(staff, report.id, {
      resolution: 'RESOLVED',
      note: 'Đã ẩn review',
    });

    const restored = await service.moderate(staff, created.id, {
      action: 'restore',
      reason: 'Khôi phục sau kiểm tra',
    });
    expect(restored.status).toBe('PUBLISHED');
  });

  it('enforces RBAC on admin endpoints and rebuilds aggregates', async () => {
    await service.createReview(customer, {
      orderId: 'ord-1',
      orderItemId: 'oi-1',
      rating: 5,
      content: 'Review cho rebuild aggregate.',
    });
    await expect(service.adminListReviews(customer, {})).rejects.toMatchObject({
      errorCode: ErrorCodes.FORBIDDEN,
    });
    const adminList = await service.adminListReviews(staff, {
      status: 'PUBLISHED',
    });
    expect(adminList.items.length).toBeGreaterThanOrEqual(1);

    const rebuilt = await service.rebuildAggregates(staff, {
      productId: 'prod-1',
    });
    expect(rebuilt.rebuilt).toBe(1);
    expect(rebuilt.summary?.totalReviews).toBe(1);
  });

  it('supports pagination filter sort and privacy on public list', async () => {
    for (let i = 0; i < 3; i += 1) {
      const oid = `ord-${i}`;
      const itemId = `oi-${i}`;
      orders.seed({
        id: oid,
        orderCode: `NT-${i}`,
        customerId: `cust-${i}`,
        status: 'DELIVERED',
        items: [
          {
            id: itemId,
            skuId: 'sku-1',
            skuCode: 'PHONE-1',
            productId: 'prod-1',
            productName: 'Phone X',
          },
        ],
        packages: [
          {
            id: `pkg-${i}`,
            status: 'DELIVERED',
            items: [{ orderItemId: itemId }],
          },
        ],
        customerSnapshot: { displayName: `User ${i}` },
      });
      await service.createReview(parseActor(`cust-${i}`, 'Customer'), {
        orderId: oid,
        orderItemId: itemId,
        rating: (i + 3) as 3 | 4 | 5,
        content: `Nội dung đánh giá số ${i} đủ dài.`,
      });
    }

    const page = await service.listProductReviews('prod-1', {
      page: 1,
      pageSize: 2,
      sort: 'highest',
    });
    expect(page.items).toHaveLength(2);
    expect(page.meta.totalItems).toBe(3);
    expect(page.items[0].rating).toBeGreaterThanOrEqual(page.items[1].rating);
    expect(page.items.every((r) => r.customerId === undefined)).toBe(true);
    expect(page.items.every((r) => !r.displayName.includes('@'))).toBe(true);

    const filtered = await service.listProductReviews('prod-1', {
      rating: 5,
      verifiedOnly: true,
    });
    expect(filtered.items.every((r) => r.rating === 5)).toBe(true);
  });

  it('publishes outbox events for create flow', async () => {
    await service.createReview(customer, {
      orderId: 'ord-1',
      orderItemId: 'oi-1',
      rating: 5,
      content: 'Kiểm tra outbox sau tạo review.',
      idempotencyKey: 'idem-create-1',
    });
    const again = await service.createReview(customer, {
      orderId: 'ord-1',
      orderItemId: 'oi-1',
      rating: 5,
      content: 'Kiểm tra outbox sau tạo review.',
      idempotencyKey: 'idem-create-1',
    });
    expect(again.rating).toBe(5);
    expect(publisher.published.length).toBeGreaterThan(0);
  });
});
