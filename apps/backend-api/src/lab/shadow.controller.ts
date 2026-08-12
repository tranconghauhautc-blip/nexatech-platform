import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../common/auth';
import { PrismaService } from '../common/prisma.service';
import { publicUser } from '../common/mappers';

/**
 * Shadow / deprecated inventory (Improper Inventory Management).
 * Not advertised prominently in Swagger tags but reachable.
 */
@ApiExcludeController()
@Controller()
export class ShadowController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('v0/internal/users')
  async shadowUsers() {
    const users = await this.prisma.user.findMany();
    return {
      deprecated: true,
      users: users.map((u) => ({
        ...publicUser(u),
        passwordHash: u.passwordHash,
      })),
    };
  }

  @Public()
  @Get('legacy/login')
  legacyLogin() {
    return {
      message: 'Deprecated — use POST /api/auth/login or GET /api/lab/login-get',
    };
  }
}
