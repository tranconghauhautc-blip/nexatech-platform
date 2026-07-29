import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import { CartService, type CartActor } from './cart.service';

function parseActor(userId?: string, guestCartToken?: string): CartActor {
  const trimmedUserId = userId?.trim() || undefined;
  return {
    userId: trimmedUserId,
    // Ownership lấy từ header identity tạm thời — không tin body.
    customerId: trimmedUserId,
    guestCartToken: guestCartToken?.trim() || undefined,
  };
}

function requireCustomerId(userId?: string): string {
  const id = userId?.trim();
  if (!id) {
    throw new AppError({
      errorCode: ErrorCodes.UNAUTHORIZED,
      message: 'Cần đăng nhập',
    });
  }
  return id;
}

@ApiTags('carts')
@ApiHeader({ name: 'x-user-id', required: false })
@ApiHeader({ name: 'x-cart-token', required: false })
@Controller({ path: 'carts', version: ['1', '2'] })
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Post('guest')
  createGuest() {
    return this.cartService.createGuestCart();
  }

  @Get('current')
  current(
    @Headers('x-user-id') userId?: string,
    @Headers('x-cart-token') cartToken?: string,
  ) {
    return this.cartService.getCurrentCart(parseActor(userId, cartToken));
  }

  @Post('current/items')
  addItem(
    @Headers('x-user-id') userId?: string,
    @Headers('x-cart-token') cartToken?: string,
    @Body() body?: Record<string, unknown>,
  ) {
    return this.cartService.addItem(
      parseActor(userId, cartToken),
      body as never,
    );
  }

  @Patch('current/items/:skuId')
  updateItem(
    @Param('skuId') skuId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-cart-token') cartToken?: string,
    @Body() body?: Record<string, unknown>,
  ) {
    return this.cartService.updateItem(
      parseActor(userId, cartToken),
      skuId,
      body as never,
    );
  }

  @Delete('current/items/:skuId')
  removeItem(
    @Param('skuId') skuId: string,
    @Headers('x-user-id') userId?: string,
    @Headers('x-cart-token') cartToken?: string,
  ) {
    return this.cartService.removeItem(parseActor(userId, cartToken), skuId);
  }

  @Delete('current')
  clear(
    @Headers('x-user-id') userId?: string,
    @Headers('x-cart-token') cartToken?: string,
  ) {
    return this.cartService.clearCart(parseActor(userId, cartToken));
  }

  @Post('merge')
  merge(
    @Headers('x-user-id') userId?: string,
    @Body() body?: Record<string, unknown>,
  ) {
    return this.cartService.mergeCart(parseActor(userId), body as never);
  }

  @Post('current/refresh')
  refresh(
    @Headers('x-user-id') userId?: string,
    @Headers('x-cart-token') cartToken?: string,
  ) {
    return this.cartService.refreshCart(parseActor(userId, cartToken));
  }

  @Post('current/validate')
  validate(
    @Headers('x-user-id') userId?: string,
    @Headers('x-cart-token') cartToken?: string,
    @Query('city') city?: string,
  ) {
    return this.cartService.validateCart(parseActor(userId, cartToken), city);
  }

  /** Đánh dấu giỏ ACTIVE → CONVERTED sau khi tạo đơn thành công (order-service). */
  @Post('convert')
  convert(
    @Headers('x-user-id') userId?: string,
    @Body() body?: Record<string, unknown>,
  ) {
    return this.cartService.convertCart(parseActor(userId), body as never);
  }
}

@ApiTags('wishlist')
@Controller({ path: 'wishlist', version: ['1', '2'] })
export class WishlistController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  list(@Headers('x-user-id') userId?: string) {
    return this.cartService.listWishlist(requireCustomerId(userId));
  }

  @Post()
  add(
    @Headers('x-user-id') userId?: string,
    @Body() body?: { productId?: string; skuId?: string },
  ) {
    if (!body?.productId) {
      throw new AppError({
        errorCode: ErrorCodes.VALIDATION_FAILED,
        message: 'Thiếu productId',
      });
    }
    return this.cartService.addWishlist(
      requireCustomerId(userId),
      body.productId,
      body.skuId,
    );
  }

  @Delete(':productId')
  remove(
    @Headers('x-user-id') userId?: string,
    @Param('productId') productId?: string,
  ) {
    if (!productId) {
      throw new AppError({
        errorCode: ErrorCodes.VALIDATION_FAILED,
        message: 'Thiếu productId',
      });
    }
    return this.cartService.removeWishlist(
      requireCustomerId(userId),
      productId,
    );
  }
}

@ApiTags('comparison')
@Controller({ path: 'comparison', version: ['1', '2'] })
export class ComparisonController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  list(@Headers('x-user-id') userId?: string) {
    return this.cartService.listComparison(requireCustomerId(userId));
  }

  @Post()
  add(
    @Headers('x-user-id') userId?: string,
    @Body() body?: { productId?: string },
  ) {
    if (!body?.productId) {
      throw new AppError({
        errorCode: ErrorCodes.VALIDATION_FAILED,
        message: 'Thiếu productId',
      });
    }
    return this.cartService.addComparison(
      requireCustomerId(userId),
      body.productId,
    );
  }

  @Delete(':productId')
  remove(
    @Headers('x-user-id') userId?: string,
    @Param('productId') productId?: string,
  ) {
    if (!productId) {
      throw new AppError({
        errorCode: ErrorCodes.VALIDATION_FAILED,
        message: 'Thiếu productId',
      });
    }
    return this.cartService.removeComparison(
      requireCustomerId(userId),
      productId,
    );
  }

  @Delete()
  clear(@Headers('x-user-id') userId?: string) {
    return this.cartService.clearComparison(requireCustomerId(userId));
  }
}

@ApiTags('recently-viewed')
@Controller({ path: 'recently-viewed', version: ['1', '2'] })
export class RecentlyViewedController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  list(
    @Headers('x-user-id') userId?: string,
    @Headers('x-cart-token') cartToken?: string,
  ) {
    return this.cartService.listRecentlyViewed(parseActor(userId, cartToken));
  }

  @Post()
  track(
    @Headers('x-user-id') userId?: string,
    @Headers('x-cart-token') cartToken?: string,
    @Body() body?: { productId?: string },
  ) {
    if (!body?.productId) {
      throw new AppError({
        errorCode: ErrorCodes.VALIDATION_FAILED,
        message: 'Thiếu productId',
      });
    }
    return this.cartService.trackRecentlyViewed(
      parseActor(userId, cartToken),
      body.productId,
    );
  }
}
