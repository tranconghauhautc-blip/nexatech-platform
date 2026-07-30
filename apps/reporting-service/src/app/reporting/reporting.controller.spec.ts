import { AdminReportingController } from './admin-reporting.controller';
import { createEventEnvelope, EventTypes } from '@nexatech/shared-events';
import { EventConsumer } from './event-consumer';
import { InMemoryReportingRepository } from './reporting.repository';
import { ReportingService } from './reporting.service';

function buildController() {
  const repository = new InMemoryReportingRepository();
  const service = new ReportingService(repository);
  const controller = new AdminReportingController(service);
  const consumer = new EventConsumer(service);
  return { repository, service, controller, consumer };
}

describe('AdminReportingController', () => {
  beforeEach(() => {
    process.env['NODE_ENV'] = 'test';
  });

  it('returns the dashboard summary for staff', async () => {
    const { controller } = buildController();
    const result = await controller.dashboard('staff-1', 'Staff');
    expect(result.totalOrders).toBe(0);
    expect(result.generatedAt).toBeDefined();
  });

  it('rejects non-staff actors', async () => {
    const { controller } = buildController();
    await expect(
      controller.dashboard('cust-1', 'Customer'),
    ).rejects.toMatchObject({ errorCode: 'REPORTING_FORBIDDEN' });
  });

  it('lists order projections after consuming an order.created event', async () => {
    const { controller, consumer } = buildController();
    await consumer.processEvent(
      createEventEnvelope({
        eventType: EventTypes.ORDER_CREATED,
        producer: 'order-service',
        traceId: 'trace-1',
        payload: {
          orderId: 'order-1',
          orderCode: 'NT-1',
          customerId: 'cust-1',
          status: 'CREATED',
          grandTotal: 200000,
          totalQuantity: 1,
        },
      }),
    );

    const result = await controller.listOrders('staff-1', 'Staff', {});
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.orderId).toBe('order-1');
  });

  it('lists payments, shipments, reviews, warranty and support projections', async () => {
    const { controller, consumer } = buildController();
    await consumer.processEvent(
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
    await consumer.processEvent(
      createEventEnvelope({
        eventType: EventTypes.SHIPMENT_DELIVERED,
        producer: 'shipping-service',
        traceId: 'trace-2',
        payload: {
          shipmentId: 'ship-1',
          orderId: 'order-1',
          status: 'DELIVERED',
        },
      }),
    );
    await consumer.processEvent(
      createEventEnvelope({
        eventType: EventTypes.REVIEW_CREATED,
        producer: 'review-service',
        traceId: 'trace-3',
        payload: {
          reviewId: 'review-1',
          productId: 'product-1',
          rating: 4,
          status: 'PUBLISHED',
        },
      }),
    );
    await consumer.processEvent(
      createEventEnvelope({
        eventType: EventTypes.WARRANTY_CLAIM_CREATED,
        producer: 'warranty-service',
        traceId: 'trace-4',
        payload: { claimCode: 'NT-W-1', orderId: 'order-1' },
      }),
    );
    await consumer.processEvent(
      createEventEnvelope({
        eventType: EventTypes.WARRANTY_RETURN_REQUESTED,
        producer: 'warranty-service',
        traceId: 'trace-5',
        payload: { returnCode: 'NT-R-1', orderId: 'order-1' },
      }),
    );
    await consumer.processEvent(
      createEventEnvelope({
        eventType: EventTypes.SUPPORT_TICKET_CREATED,
        producer: 'support-service',
        traceId: 'trace-6',
        payload: { ticketCode: 'NT-S-1', customerId: 'cust-1' },
      }),
    );

    const payments = await controller.listPayments('staff-1', 'Staff', {});
    expect(payments.items).toHaveLength(1);
    const shipments = await controller.listShipments('staff-1', 'Staff', {});
    expect(shipments.items).toHaveLength(1);
    const reviews = await controller.listReviews('staff-1', 'Staff', {});
    expect(reviews.items).toHaveLength(1);
    const claims = await controller.listWarrantyClaims('staff-1', 'Staff', {});
    expect(claims.items).toHaveLength(1);
    const returns = await controller.listWarrantyReturns(
      'staff-1',
      'Staff',
      {},
    );
    expect(returns.items).toHaveLength(1);
    const tickets = await controller.listSupportTickets('staff-1', 'Staff', {});
    expect(tickets.items).toHaveLength(1);

    const dashboard = await controller.dashboard('staff-1', 'Staff');
    expect(dashboard.totalRevenue).toBe(100000);
  });

  it('records audit via POST /admin/reporting/audit and lists it', async () => {
    const { controller } = buildController();
    const result = await controller.recordAudit('staff-1', 'Staff', undefined, {
      action: 'reporting.controller.test',
    });
    expect(result.auditLog.action).toBe('reporting.controller.test');

    const logs = await controller.listAuditLogs('staff-1', 'Staff', {});
    expect(logs.items).toHaveLength(1);
  });

  it('supports idempotency-key header on POST /admin/reporting/audit', async () => {
    const { controller } = buildController();
    const first = await controller.recordAudit(
      'staff-1',
      'Staff',
      'idem-key-ctrl-1',
      { action: 'reporting.controller.idem' },
    );
    const again = await controller.recordAudit(
      'staff-1',
      'Staff',
      'idem-key-ctrl-1',
      { action: 'reporting.controller.idem' },
    );
    expect(again.auditLog.id).toBe(first.auditLog.id);
  });

  it('lists daily metrics', async () => {
    const { controller, consumer } = buildController();
    await consumer.processEvent(
      createEventEnvelope({
        eventType: EventTypes.ORDER_CREATED,
        producer: 'order-service',
        traceId: 'trace-1',
        payload: {
          orderId: 'order-1',
          status: 'CREATED',
          grandTotal: 1,
          totalQuantity: 1,
        },
      }),
    );
    const result = await controller.dailyMetrics('staff-1', 'Staff', {});
    expect(
      result.items.some(
        (m: { metricKey: string }) => m.metricKey === 'orders_created',
      ),
    ).toBe(true);
  });
});
