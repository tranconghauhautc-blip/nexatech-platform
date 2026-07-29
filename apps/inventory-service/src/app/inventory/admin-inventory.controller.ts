import { Body, Controller, Headers, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InventoryService, parseRolesHeader } from './inventory.service';
import type { ReturnStockRequestInput } from './inventory.types';

@ApiTags('admin-inventory')
@Controller({ path: 'admin/inventory', version: ['1', '2'] })
export class AdminInventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('warehouses')
  createWarehouse(
    @Headers('x-user-id') userId: string,
    @Headers('x-user-roles') rolesHeader: string,
    @Body() body: unknown,
  ) {
    return this.inventoryService.createWarehouse(
      body,
      parseRolesHeader(rolesHeader),
      userId,
    );
  }

  @Post('stores')
  createStore(
    @Headers('x-user-id') userId: string,
    @Headers('x-user-roles') rolesHeader: string,
    @Body() body: unknown,
  ) {
    return this.inventoryService.createStore(
      body,
      parseRolesHeader(rolesHeader),
      userId,
    );
  }

  @Post('stock/receive')
  receiveStock(
    @Headers('x-user-id') userId: string,
    @Headers('x-user-roles') rolesHeader: string,
    @Body() body: unknown,
  ) {
    return this.inventoryService.receiveStock(
      body,
      parseRolesHeader(rolesHeader),
      userId,
    );
  }

  @Post('stock/issue')
  issueStock(
    @Headers('x-user-id') userId: string,
    @Headers('x-user-roles') rolesHeader: string,
    @Body() body: unknown,
  ) {
    return this.inventoryService.issueStock(
      body,
      parseRolesHeader(rolesHeader),
      userId,
    );
  }

  @Post('stock/reserve')
  reserveStock(
    @Headers('x-user-id') userId: string,
    @Headers('x-user-roles') rolesHeader: string,
    @Body() body: unknown,
  ) {
    return this.inventoryService.reserveStock(
      body,
      parseRolesHeader(rolesHeader),
      userId,
    );
  }

  @Post('stock/adjust')
  adjustStock(
    @Headers('x-user-id') userId: string,
    @Headers('x-user-roles') rolesHeader: string,
    @Body() body: unknown,
  ) {
    return this.inventoryService.adjustStock(
      body,
      parseRolesHeader(rolesHeader),
      userId,
    );
  }

  @Post('stock/return')
  returnStock(
    @Headers('x-user-id') userId: string,
    @Headers('x-user-roles') rolesHeader: string,
    @Body() body: ReturnStockRequestInput,
  ) {
    return this.inventoryService.returnStock(
      { ...body, actorId: userId },
      parseRolesHeader(rolesHeader),
    );
  }

  @Post('reservations/:id/release')
  releaseReservation(
    @Headers('x-user-id') userId: string,
    @Headers('x-user-roles') rolesHeader: string,
    @Param('id') id: string,
  ) {
    return this.inventoryService.releaseReservation(
      id,
      parseRolesHeader(rolesHeader),
      userId,
    );
  }

  @Post('reservations/:id/commit')
  commitReservation(
    @Headers('x-user-id') userId: string,
    @Headers('x-user-roles') rolesHeader: string,
    @Param('id') id: string,
  ) {
    return this.inventoryService.commitReservation(
      id,
      parseRolesHeader(rolesHeader),
      userId,
    );
  }

  @Post('transfers')
  transferStock(
    @Headers('x-user-id') userId: string,
    @Headers('x-user-roles') rolesHeader: string,
    @Body() body: unknown,
  ) {
    return this.inventoryService.transferStock(
      body,
      parseRolesHeader(rolesHeader),
      userId,
    );
  }
}
