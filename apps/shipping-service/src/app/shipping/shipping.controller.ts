import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { ShippingService, parseActor } from './shipping.service';

@ApiTags('shipping')
@ApiBearerAuth('bearer')
@ApiHeader({ name: 'x-user-id', required: false })
@ApiHeader({ name: 'x-user-roles', required: false })
@Controller({ path: 'shipping', version: ['1', '2'] })
export class ShippingQuotesSlotsController {
  constructor(private readonly shippingService: ShippingService) {}

  @Post('quotes')
  createQuote(
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Body() body?: unknown,
  ) {
    return this.shippingService.createQuote(parseActor(userId, roles), body);
  }

  @Get('quotes/:quoteId')
  getQuote(
    @Param('quoteId') quoteId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
  ) {
    return this.shippingService.getQuote(parseActor(userId, roles), quoteId);
  }

  @Get('slots')
  listSlots(
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Query() query?: Record<string, unknown>,
  ) {
    return this.shippingService.listSlots(
      parseActor(userId, roles),
      query ?? {},
    );
  }

  @Post('slots/:slotId/reserve')
  reserveSlot(
    @Param('slotId') slotId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Body() body?: unknown,
  ) {
    return this.shippingService.reserveSlot(
      parseActor(userId, roles),
      slotId,
      body ?? {},
    );
  }

  @Delete('slot-reservations/:reservationId')
  releaseReservation(
    @Param('reservationId') reservationId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
  ) {
    return this.shippingService.releaseSlotReservation(
      parseActor(userId, roles),
      reservationId,
    );
  }

  @Post('providers/:provider/webhook')
  webhook(
    @Param('provider') provider: string,
    @Headers('x-shipping-signature') signature?: string,
    @Headers('x-webhook-token') token?: string,
    @Body() body?: unknown,
  ) {
    return this.shippingService.handleWebhook(
      provider,
      (body ?? {}) as Record<string, unknown>,
      signature ?? token,
    );
  }

  @Get('tracking/:trackingCode')
  publicTracking(@Param('trackingCode') trackingCode: string) {
    return this.shippingService.publicTracking(trackingCode);
  }
}

@ApiTags('shipments')
@ApiHeader({ name: 'x-user-id', required: false })
@ApiHeader({ name: 'x-user-roles', required: false })
@Controller({ path: 'shipments', version: ['1', '2'] })
export class ShipmentsController {
  constructor(private readonly shippingService: ShippingService) {}

  @Post()
  create(
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Body() body?: unknown,
  ) {
    return this.shippingService.createShipment(parseActor(userId, roles), body);
  }

  @Get('order/:orderId')
  byOrder(
    @Param('orderId') orderId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
  ) {
    return this.shippingService.getByOrder(parseActor(userId, roles), orderId);
  }

  @Get(':shipmentId')
  get(
    @Param('shipmentId') shipmentId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
  ) {
    return this.shippingService.getShipment(
      parseActor(userId, roles),
      shipmentId,
    );
  }

  @Get(':shipmentId/tracking')
  tracking(
    @Param('shipmentId') shipmentId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
  ) {
    return this.shippingService.getShipmentTracking(
      parseActor(userId, roles),
      shipmentId,
    );
  }

  @Post(':shipmentId/book')
  book(
    @Param('shipmentId') shipmentId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Body() body?: unknown,
  ) {
    return this.shippingService.bookShipment(
      parseActor(userId, roles),
      shipmentId,
      body ?? {},
    );
  }

  @Post(':shipmentId/cancel')
  cancel(
    @Param('shipmentId') shipmentId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Body() body?: unknown,
  ) {
    return this.shippingService.cancelShipment(
      parseActor(userId, roles),
      shipmentId,
      body,
    );
  }

  @Post(':shipmentId/status-transitions')
  transition(
    @Param('shipmentId') shipmentId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Body() body?: unknown,
  ) {
    return this.shippingService.transitionStatus(
      parseActor(userId, roles),
      shipmentId,
      body,
    );
  }

  @Post(':shipmentId/ready-for-pickup')
  readyForPickup(
    @Param('shipmentId') shipmentId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Body() body?: unknown,
  ) {
    return this.shippingService.readyForPickup(
      parseActor(userId, roles),
      shipmentId,
      body ?? {},
    );
  }

  @Post(':shipmentId/confirm-pickup')
  confirmPickup(
    @Param('shipmentId') shipmentId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-roles') roles?: string,
    @Body() body?: unknown,
  ) {
    return this.shippingService.confirmPickup(
      parseActor(userId, roles),
      shipmentId,
      body,
    );
  }
}
