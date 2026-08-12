import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiBody,
} from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../common/prisma.service';
import { CurrentUser, AuthUser } from '../common/auth';
import { OrderDto } from '../common/dto';
import { toNumber } from '../common/mappers';

class CheckoutDto {
  @ApiPropertyOptional({
    description: 'LAB: same key can be reused (double checkout)',
  })
  @IsOptional()
  @IsString()
  checkoutKey?: string;
}

function mapOrder(o: {
  id: string;
  userId: string;
  status: string;
  totalAmount: { toString(): string } | number;
  createdAt: Date;
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    unitPrice: { toString(): string } | number;
  }>;
}): OrderDto {
  return {
    id: o.id,
    userId: o.userId,
    status: o.status,
    totalAmount: toNumber(o.totalAmount as never),
    items: o.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      quantity: i.quantity,
      unitPrice: toNumber(i.unitPrice as never),
    })),
    createdAt: o.createdAt.toISOString(),
  };
}

@ApiTags('Orders')
@ApiBearerAuth('bearer')
@Controller('orders')
export class OrdersController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('checkout')
  @ApiOperation({
    summary: 'Checkout cart into an order',
    description:
      'VULNERABLE business flows: uses client unitPrice (price tampering); allows buy over stock; allows negative qty; double checkout with same checkoutKey; no idempotency lock.',
  })
  @ApiBody({ type: CheckoutDto })
  @ApiOkResponse({ type: OrderDto })
  async checkout(
    @CurrentUser() user: AuthUser,
    @Body() dto: CheckoutDto,
  ): Promise<OrderDto> {
    const cart = await this.prisma.cartItem.findMany({
      where: { userId: user.id },
      include: { product: true },
    });
    if (cart.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // LAB: no stock enforcement; trust cart unitPrice
    let total = 0;
    const lines = cart.map((c) => {
      const unit =
        c.unitPrice != null ? toNumber(c.unitPrice) : toNumber(c.product.price);
      total += unit * c.quantity;
      return {
        productId: c.productId,
        quantity: c.quantity,
        unitPrice: unit,
      };
    });

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          userId: user.id,
          status: 'PAID',
          totalAmount: total,
          checkoutKey: dto.checkoutKey ?? null,
          items: { create: lines },
        },
        include: { items: true },
      });

      // LAB: decrement stock without checking >= quantity (buy over stock)
      for (const line of lines) {
        await tx.product.update({
          where: { id: line.productId },
          data: { stock: { decrement: line.quantity } },
        });
      }

      // LAB: do NOT clear cart when checkoutKey present → double checkout
      if (!dto.checkoutKey) {
        await tx.cartItem.deleteMany({ where: { userId: user.id } });
      }

      return created;
    });

    return mapOrder(order);
  }

  @Get()
  @ApiOperation({ summary: 'List own orders' })
  @ApiOkResponse({ type: [OrderDto] })
  async list(@CurrentUser() user: AuthUser): Promise<OrderDto[]> {
    const rows = await this.prisma.order.findMany({
      where: { userId: user.id },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(mapOrder);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'View order by id',
    description:
      'VULNERABLE — BOLA/IDOR: any authenticated user can read any order by UUID (no ownership check).',
  })
  @ApiOkResponse({ type: OrderDto })
  async get(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<OrderDto> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    // LAB: intentional IDOR — no userId check
    void user;
    return mapOrder(order);
  }

  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Cancel order',
    description:
      'VULNERABLE — Sensitive Business Flow: allows cancelling COMPLETED/SHIPPED orders; BOLA on order id.',
  })
  @ApiOkResponse({ type: OrderDto })
  async cancel(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<OrderDto> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    // LAB: no ownership + no status guard
    void user;
    const updated = await this.prisma.order.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: { items: true },
    });
    return mapOrder(updated);
  }
}
