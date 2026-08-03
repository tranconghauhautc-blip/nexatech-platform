import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';

@ApiTags('inventory')
@Controller({ path: '', version: ['1', '2'] })
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('warehouses')
  warehouses() {
    return this.inventoryService.listWarehouses();
  }

  @Get('stores/pickup')
  pickupStores() {
    return this.inventoryService.listPickupStores();
  }

  @Get('stores')
  stores() {
    return this.inventoryService.listStores();
  }

  @Get('stores/:id')
  store(@Param('id') id: string) {
    return this.inventoryService.getStoreById(id);
  }

  @Get('stock')
  stock(
    @Query('skuCode') skuCode?: string,
    @Query('locationType') locationType?: 'warehouse' | 'store',
    @Query('locationId') locationId?: string,
  ) {
    return this.inventoryService.listStock({
      skuCode,
      locationType,
      locationId,
    });
  }

  @Get('stock/availability')
  availability(
    @Query('skuCode') skuCode: string,
    @Query('quantity') quantity?: string,
    @Query('city') city?: string,
  ) {
    return this.inventoryService.getAvailability({ skuCode, quantity, city });
  }

  @Get('stock/sources')
  sources(
    @Query('skuCode') skuCode: string,
    @Query('quantity') quantity?: string,
    @Query('city') city?: string,
  ) {
    return this.inventoryService.selectSource(
      skuCode,
      quantity ? Number(quantity) : 1,
      city,
    );
  }

  @Get('stock/low')
  lowStock() {
    return this.inventoryService.listLowStock();
  }

  @Get('movements')
  movements(
    @Query('skuCode') skuCode?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.inventoryService.listMovements({ skuCode, page, pageSize });
  }

  @Get('reservations/:id')
  reservation(@Param('id') id: string) {
    return this.inventoryService.getReservationById(id);
  }
}
