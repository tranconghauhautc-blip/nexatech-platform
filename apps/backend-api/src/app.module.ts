import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaService } from './common/prisma.service';
import { JwtAuthGuard, RolesGuard } from './common/auth';
import { AuthController } from './auth/auth.controller';
import { UsersController } from './users/users.controller';
import { ProductsController } from './products/products.controller';
import { CartController } from './cart/cart.controller';
import { OrdersController } from './orders/orders.controller';
import { ReviewsController } from './reviews/reviews.controller';
import { AdminController } from './admin/admin.controller';
import { LabController } from './lab/lab.controller';
import { ShadowController } from './lab/shadow.controller';
import { HealthController } from './health/health.controller';

@Module({
  controllers: [
    HealthController,
    AuthController,
    UsersController,
    ProductsController,
    CartController,
    OrdersController,
    ReviewsController,
    AdminController,
    LabController,
    ShadowController,
  ],
  providers: [
    PrismaService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
