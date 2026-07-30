import { ErrorCodes } from '@nexatech/shared-errors';
import { createEventEnvelope, EventTypes } from '@nexatech/shared-events';
import { InMemoryReportingRepository } from './reporting.repository';
import { ReportingService, parseActor } from './reporting.service';

describe('ReportingService', () => {
  let repository: InMemoryReportingRepository;
  let service: ReportingService;

  const staff = parseActor('staff-1', 'Staff');
  const customer = parseActor('cust-1', 'Customer');

  beforeEach(() => {
    process.env['NODE_ENV'] = 'test';
    repository = new InMemoryReportingRepository();
    service = new ReportingService(repository);
  });

  describe('processEventEnvelope — projections', () => {
    it('upserts an OrderProjection on order.created and derives status for order.shipped', async () => {
      const created = createEventEnvelope({
        eventType: EventTypes.ORDER_CREATED,
        producer: 'order-service',
        traceId: 'trace-1',
        payload: {
          orderId: 'order-1',
          orderCode: 'NT-1',
          customerId: 'cust-1',
          status: 'CREATED',
          grandTotal: 1000000,
          totalQuantity: 2,
        },
      });
      const result = await service.processEventEnvelope(created);
      expect(result.processed).toBe(true);
      expect(result.handled).toBe(true);

      const shipped = createEventEnvelope({
        eventType: EventTypes.ORDER_SHIPPED,
        producer: 'order-service',
        traceId: 'trace-2',
        payload: {
          orderId: 'order-1',
          packageId: 'pkg-1',
          shipmentId: 'ship-1',
        },
      });
      await service.processEventEnvelope(shipped);

      const listed = await service.listOrders(staff, {});
      expect(listed.items).toHaveLength(1);
      expect(listed.items[0]?.status).toBe('SHIPPED');
      // Fields not present in order.shipped payload must be preserved.
      expect(listed.items[0]?.orderCode).toBe('NT-1');
      expect(listed.items[0]?.grandTotal).toBe(1000000);
      expect(listed.items[0]?.lastEventType).toBe('order.shipped');
    });

    it('is idempotent for the same eventId (inbox pattern)', async () => {
      const envelope = createEventEnvelope({
        eventType: EventTypes.ORDER_CONFIRMED,
        producer: 'order-service',
        traceId: 'trace-1',
        payload: { orderId: 'order-1' },
        eventId: 'fixed-event-1',
      });
      const first = await service.processEventEnvelope(envelope);
      expect(first.processed).toBe(true);
      const second = await service.processEventEnvelope(envelope);
      expect(second.processed).toBe(false);

      const listed = await service.listOrders(staff, {});
      expect(listed.items).toHaveLength(1);
    });

    it('upserts PaymentProjection and increments revenue_vnd on payment.paid', async () => {
      const envelope = createEventEnvelope({
        eventType: EventTypes.PAYMENT_PAID,
        producer: 'payment-service',
        traceId: 'trace-1',
        payload: {
          paymentId: 'pay-1',
          orderId: 'order-1',
          status: 'PAID',
          amount: 500000,
          method: 'VNPAY',
          currency: 'VND',
        },
      });
      await service.processEventEnvelope(envelope);

      const payments = await service.listPayments(staff, {});
      expect(payments.items).toHaveLength(1);
      expect(payments.items[0]?.amount).toBe(500000);

      const dashboard = await service.getDashboard(staff);
      expect(dashboard.totalRevenue).toBe(500000);
      expect(dashboard.paymentsByStatus['PAID']).toBe(1);
    });

    it('upserts ShipmentProjection with carrierCode from provider fallback', async () => {
      const envelope = createEventEnvelope({
        eventType: EventTypes.SHIPMENT_DELIVERED,
        producer: 'shipping-service',
        traceId: 'trace-1',
        payload: {
          shipmentId: 'ship-1',
          orderId: 'order-1',
          status: 'DELIVERED',
          provider: 'MOCK',
          trackingCode: 'TRACK-1',
        },
      });
      await service.processEventEnvelope(envelope);
      const shipments = await service.listShipments(staff, {});
      expect(shipments.items[0]?.carrierCode).toBe('MOCK');
      expect(shipments.items[0]?.status).toBe('DELIVERED');
    });

    it('upserts ReviewProjection and marks deletedAt on review.deleted', async () => {
      const created = createEventEnvelope({
        eventType: EventTypes.REVIEW_CREATED,
        producer: 'review-service',
        traceId: 'trace-1',
        payload: {
          reviewId: 'review-1',
          productId: 'product-1',
          rating: 5,
          status: 'PUBLISHED',
        },
      });
      await service.processEventEnvelope(created);

      const deleted = createEventEnvelope({
        eventType: EventTypes.REVIEW_DELETED,
        producer: 'review-service',
        traceId: 'trace-2',
        payload: { reviewId: 'review-1', productId: 'product-1' },
      });
      await service.processEventEnvelope(deleted);

      const reviews = await service.listReviews(staff, {});
      expect(reviews.items[0]?.status).toBe('DELETED');
      expect(reviews.items[0]?.deletedAt).toBeDefined();
      expect(reviews.items[0]?.rating).toBe(5);
    });

    it('upserts WarrantyClaimProjection using claimCode fallback id', async () => {
      const envelope = createEventEnvelope({
        eventType: EventTypes.WARRANTY_CLAIM_CREATED,
        producer: 'warranty-service',
        traceId: 'trace-1',
        payload: {
          claimCode: 'NT-W-1',
          orderId: 'order-1',
          productId: 'product-1',
        },
      });
      await service.processEventEnvelope(envelope);
      const claims = await service.listWarrantyClaims(staff, {});
      expect(claims.items[0]?.claimId).toBe('NT-W-1');
      expect(claims.items[0]?.status).toBe('SUBMITTED');
    });

    it('upserts WarrantyReturnProjection using returnCode fallback id', async () => {
      const envelope = createEventEnvelope({
        eventType: EventTypes.WARRANTY_RETURN_REQUESTED,
        producer: 'warranty-service',
        traceId: 'trace-1',
        payload: { returnCode: 'NT-R-1', orderId: 'order-1' },
      });
      await service.processEventEnvelope(envelope);
      const returns = await service.listWarrantyReturns(staff, {});
      expect(returns.items[0]?.returnId).toBe('NT-R-1');
      expect(returns.items[0]?.status).toBe('REQUESTED');
    });

    it('upserts SupportTicketProjection using ticketCode fallback id', async () => {
      const envelope = createEventEnvelope({
        eventType: EventTypes.SUPPORT_TICKET_CREATED,
        producer: 'support-service',
        traceId: 'trace-1',
        payload: {
          ticketCode: 'NT-S-1',
          customerId: 'cust-1',
          category: 'ORDER',
          priority: 'NORMAL',
        },
      });
      await service.processEventEnvelope(envelope);
      const tickets = await service.listSupportTickets(staff, {});
      expect(tickets.items[0]?.ticketId).toBe('NT-S-1');
      expect(tickets.items[0]?.status).toBe('OPEN');
    });

    it('inserts AuditLogProjection for audit.recorded events (idempotent by sourceEventId)', async () => {
      const envelope = createEventEnvelope({
        eventType: EventTypes.AUDIT_RECORDED,
        producer: 'media-service',
        traceId: 'trace-1',
        payload: {
          mediaId: 'media-1',
          action: 'media.confirm',
          actorId: 'staff-1',
        },
        eventId: 'audit-event-1',
      });
      await service.processEventEnvelope(envelope);
      const logs = await service.listAuditLogs(staff, {});
      expect(logs.items).toHaveLength(1);
      expect(logs.items[0]?.action).toBe('media.confirm');
      expect(logs.items[0]?.resourceId).toBe('media-1');
      expect(logs.items[0]?.serviceName).toBe('media-service');
    });

    it('does not upsert a projection when the domain id cannot be resolved', async () => {
      const envelope = createEventEnvelope({
        eventType: EventTypes.ORDER_CREATED,
        producer: 'order-service',
        traceId: 'trace-1',
        payload: { orderCode: 'NT-1' },
      });
      const result = await service.processEventEnvelope(envelope);
      expect(result.processed).toBe(true);
      expect(result.handled).toBe(false);
      const listed = await service.listOrders(staff, {});
      expect(listed.items).toHaveLength(0);
    });
  });

  describe('RBAC — Staff+', () => {
    it('rejects non-staff actors from dashboard and listing endpoints', async () => {
      await expect(service.getDashboard(customer)).rejects.toMatchObject({
        errorCode: ErrorCodes.REPORTING_FORBIDDEN,
      });
      await expect(service.listOrders(customer, {})).rejects.toMatchObject({
        errorCode: ErrorCodes.REPORTING_FORBIDDEN,
      });
      await expect(
        service.recordAudit(customer, { action: 'test.action' }),
      ).rejects.toMatchObject({ errorCode: ErrorCodes.REPORTING_FORBIDDEN });
    });

    it('requires authentication (UNAUTHORIZED) for anonymous actors', async () => {
      const anonymous = parseActor(undefined, undefined);
      await expect(service.getDashboard(anonymous)).rejects.toMatchObject({
        errorCode: ErrorCodes.UNAUTHORIZED,
      });
    });

    it('allows staff to access the dashboard', async () => {
      const dashboard = await service.getDashboard(staff);
      expect(dashboard.totalOrders).toBe(0);
      expect(dashboard.generatedAt).toBeDefined();
    });
  });

  describe('recordAudit', () => {
    it('records a manual audit entry and writes a local AuditLog', async () => {
      const result = await service.recordAudit(staff, {
        action: 'reporting.manual.test',
        resourceType: 'ORDER',
        resourceId: 'order-1',
        details: { note: 'test' },
      });
      expect(result.auditLog.action).toBe('reporting.manual.test');
      expect(result.auditLog.actorId).toBe('staff-1');

      const logs = await service.listAuditLogs(staff, {});
      expect(logs.items).toHaveLength(1);
    });

    it('is idempotent for repeated idempotencyKey', async () => {
      const first = await service.recordAudit(staff, {
        action: 'reporting.manual.dup',
        idempotencyKey: 'audit-key-1',
      });
      const again = await service.recordAudit(staff, {
        action: 'reporting.manual.dup',
        idempotencyKey: 'audit-key-1',
      });
      expect(again.auditLog.id).toBe(first.auditLog.id);

      const logs = await service.listAuditLogs(staff, {});
      expect(logs.items).toHaveLength(1);
    });

    it('accepts idempotency-key header as fallback when body omits it', async () => {
      const first = await service.recordAudit(
        staff,
        { action: 'reporting.manual.header' },
        'header-audit-key-1',
      );
      const again = await service.recordAudit(
        staff,
        { action: 'reporting.manual.header' },
        'header-audit-key-1',
      );
      expect(again.auditLog.id).toBe(first.auditLog.id);
    });
  });

  describe('metrics/daily', () => {
    it('lists daily metrics filtered by domain', async () => {
      await service.processEventEnvelope(
        createEventEnvelope({
          eventType: EventTypes.PAYMENT_PAID,
          producer: 'payment-service',
          traceId: 'trace-1',
          payload: {
            paymentId: 'pay-1',
            orderId: 'order-1',
            status: 'PAID',
            amount: 100000,
          },
        }),
      );
      const result = await service.listDailyMetrics(staff, {
        domain: 'PAYMENT',
      });
      const revenueMetric = result.items.find(
        (m) => m.metricKey === 'revenue_vnd',
      );
      expect(revenueMetric?.value).toBe(100000);
    });
  });
});
