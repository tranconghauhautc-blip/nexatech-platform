import { Test } from '@nestjs/testing';
import {
  ShipmentsController,
  ShippingQuotesSlotsController,
} from './shipping.controller';
import { ShippingService } from './shipping.service';

describe('Shipping controllers', () => {
  it('wires quote, tracking and shipment endpoints', async () => {
    const shippingService = {
      createQuote: jest.fn().mockResolvedValue({ id: 'q1' }),
      publicTracking: jest
        .fn()
        .mockResolvedValue({ trackingCode: 'T1', status: 'IN_TRANSIT' }),
      handleWebhook: jest.fn().mockResolvedValue({ ok: true }),
      createShipment: jest.fn().mockResolvedValue({ id: 's1' }),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [ShippingQuotesSlotsController, ShipmentsController],
      providers: [{ provide: ShippingService, useValue: shippingService }],
    }).compile();
    const quotes = moduleRef.get(ShippingQuotesSlotsController);
    const shipments = moduleRef.get(ShipmentsController);

    await quotes.createQuote('cust-1', 'Customer', {
      orderId: 'o1',
      idempotencyKey: 'idem-ctrl-1',
    });
    expect(shippingService.createQuote).toHaveBeenCalled();

    await quotes.publicTracking('T1');
    expect(shippingService.publicTracking).toHaveBeenCalledWith('T1');

    await quotes.webhook('MOCK', 'sig', undefined, { status: 'delivered' });
    expect(shippingService.handleWebhook).toHaveBeenCalled();

    await shipments.create('cust-1', 'Customer', {
      orderId: 'o1',
      packageId: 'p1',
      idempotencyKey: 'idem-ship-1',
    });
    expect(shippingService.createShipment).toHaveBeenCalled();
  });
});
