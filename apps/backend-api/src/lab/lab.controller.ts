import {
  Controller,
  Get,
  Query,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiProperty,
} from '@nestjs/swagger';
import { Public } from '../common/auth';
import { PrismaService } from '../common/prisma.service';

class SsrfResultDto {
  @ApiProperty()
  url!: string;

  @ApiProperty()
  status!: number;

  @ApiProperty()
  bodyPreview!: string;
}

class JwtAlgNoneDto {
  @ApiProperty({
    description: 'Unsigned JWT (alg=none) accepted by /api/auth and guards',
  })
  token!: string;

  @ApiProperty()
  hint!: string;
}

class DebugDto {
  @ApiProperty()
  env!: Record<string, string | undefined>;

  @ApiProperty()
  nodeVersion!: string;

  @ApiProperty()
  cwd!: string;
}

class InventoryDto {
  @ApiProperty({ type: [String] })
  shadowRoutes!: string[];

  @ApiProperty({ type: [String] })
  deprecatedRoutes!: string[];

  @ApiProperty()
  note!: string;
}

class UnsafeConsumeDto {
  @ApiProperty()
  productId!: string;

  @ApiProperty()
  callbackUrl!: string;

  @ApiProperty()
  fetchedStatus!: number;

  @ApiProperty()
  bodyPreview!: string;
}

@ApiTags('Lab')
@Controller('lab')
export class LabController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('ssrf-probe')
  @ApiOperation({
    summary: 'SSRF probe',
    description:
      'VULNERABLE — SSRF: server fetches arbitrary URL. Try http://127.0.0.1:3000/health or internal K8s DNS.',
  })
  @ApiQuery({
    name: 'url',
    required: true,
    example: 'http://127.0.0.1:3000/health',
  })
  @ApiOkResponse({ type: SsrfResultDto })
  async ssrf(@Query('url') url?: string): Promise<SsrfResultDto> {
    if (!url) throw new BadRequestException('url query required');
    // LAB: no allow-list / no private-IP block
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });
    const text = await res.text();
    return {
      url,
      status: res.status,
      bodyPreview: text.slice(0, 2000),
    };
  }

  @Public()
  @Get('jwt-alg-none')
  @ApiOperation({
    summary: 'Mint alg=none JWT',
    description:
      'VULNERABLE — Broken Authentication helper: returns unsigned JWT accepted by the API.',
  })
  @ApiQuery({ name: 'sub', required: false, description: 'User UUID' })
  @ApiQuery({ name: 'role', required: false, example: 'ADMIN' })
  @ApiQuery({ name: 'username', required: false, example: 'attacker' })
  @ApiOkResponse({ type: JwtAlgNoneDto })
  jwtAlgNone(
    @Query('sub') sub?: string,
    @Query('role') role?: string,
    @Query('username') username?: string,
  ): JwtAlgNoneDto {
    const header = Buffer.from(
      JSON.stringify({ alg: 'none', typ: 'JWT' }),
    ).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        sub: sub || '00000000-0000-4000-8000-000000000001',
        username: username || 'attacker',
        role: role || 'ADMIN',
        typ: 'access',
      }),
    ).toString('base64url');
    return {
      token: `${header}.${payload}.`,
      hint: 'Authorization: Bearer <token> — also try headers x-user-id + x-user-role: ADMIN',
    };
  }

  @Public()
  @Get('debug')
  @ApiOperation({
    summary: 'Debug dump',
    description:
      'VULNERABLE — Security Misconfiguration: exposes env (incl. secrets if present).',
  })
  @ApiOkResponse({ type: DebugDto })
  debug(): DebugDto {
    return {
      env: {
        NODE_ENV: process.env['NODE_ENV'],
        PORT: process.env['PORT'],
        DATABASE_URL: process.env['DATABASE_URL'],
        JWT_SECRET: process.env['JWT_SECRET'],
        ADMIN_USERNAME: process.env['ADMIN_USERNAME'],
        POD_NAME: process.env['HOSTNAME'],
      },
      nodeVersion: process.version,
      cwd: process.cwd(),
    };
  }

  @Public()
  @Get('inventory')
  @ApiOperation({
    summary: 'Shadow / deprecated API inventory',
    description:
      'VULNERABLE — Improper Inventory Management: documents and exposes shadow routes.',
  })
  @ApiOkResponse({ type: InventoryDto })
  inventory(): InventoryDto {
    return {
      shadowRoutes: [
        'GET /api/lab/ssrf-probe',
        'GET /api/lab/jwt-alg-none',
        'GET /api/lab/debug',
        'GET /api/lab/unsafe-consume',
        'GET /api/v0/internal/users',
        'GET /api/legacy/login',
      ],
      deprecatedRoutes: [
        'GET /api/legacy/login?username=&password=',
        'GET /api/v0/internal/users',
      ],
      note: 'These endpoints remain enabled for API Security lab demos.',
    };
  }

  @Public()
  @Get('unsafe-consume')
  @ApiOperation({
    summary: 'Unsafe consumption of product callbackUrl',
    description:
      'VULNERABLE — Unsafe Consumption of APIs: loads product.metadata.callbackUrl and fetches it server-side without validation.',
  })
  @ApiQuery({ name: 'productId', required: true })
  @ApiOkResponse({ type: UnsafeConsumeDto })
  async unsafeConsume(
    @Query('productId') productId?: string,
  ): Promise<UnsafeConsumeDto> {
    if (!productId) throw new BadRequestException('productId required');
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw new BadRequestException('product not found');
    const meta = (product.metadata ?? {}) as Record<string, unknown>;
    const callbackUrl = String(meta['callbackUrl'] ?? '');
    if (!callbackUrl) {
      throw new BadRequestException(
        'product.metadata.callbackUrl missing — set via admin product update',
      );
    }
    const res = await fetch(callbackUrl, {
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });
    const text = await res.text();
    return {
      productId,
      callbackUrl,
      fetchedStatus: res.status,
      bodyPreview: text.slice(0, 2000),
    };
  }

  @Public()
  @Get('login-get')
  @ApiOperation({
    summary: 'Legacy GET login (credentials in query)',
    description:
      'VULNERABLE — Broken Authentication / Improper Inventory: credentials in URL.',
  })
  @ApiQuery({ name: 'username', required: true })
  @ApiQuery({ name: 'password', required: true })
  loginGet(
    @Query('username') username?: string,
    @Query('password') password?: string,
  ) {
    return {
      warning: 'credentials accepted via query string',
      username,
      passwordLength: password?.length ?? 0,
      next: 'Use POST /api/auth/login for a real token; this shadow route only echoes.',
    };
  }

  @Public()
  @Get('reflect-headers')
  @ApiOperation({
    summary: 'Reflect request headers',
    description: 'LAB Security Misconfiguration / info disclosure.',
  })
  reflect(@Headers() headers: Record<string, string>) {
    return { headers };
  }
}
