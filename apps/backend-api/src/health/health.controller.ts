import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { Public } from '../common/auth';
import { PrismaService } from '../common/prisma.service';
import { ApiProperty } from '@nestjs/swagger';

class HealthDto {
  @ApiProperty({ example: 'ok' })
  status!: string;
}

@ApiTags('Lab')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness/readiness aggregate' })
  @ApiOkResponse({ type: HealthDto })
  health(): HealthDto {
    return { status: 'ok' };
  }

  @Public()
  @Get('live')
  live(): HealthDto {
    return { status: 'ok' };
  }

  @Public()
  @Get('ready')
  async ready(): Promise<HealthDto> {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  }
}
