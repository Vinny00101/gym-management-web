import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator.js';
import { PrismaService } from '../database/prisma.service.js';

@ApiTags('health')
@Public()
// Sonda de infraestrutura: fica em /api/health e não acompanha a versão da API.
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly prismaService: PrismaService,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Checks API and database availability' })
  @ApiResponse({ status: 200, description: 'API and database are healthy' })
  @ApiResponse({ status: 503, description: 'Database is unavailable' })
  check() {
    return this.healthCheckService.check([
      this.healthIndicatorService
        .check('database')
        .attempt(() => this.prismaService.$queryRaw`SELECT 1`)
        .withSuccessData(() => ({ connected: true }))
        .withFailureData(() => ({ message: 'Database is unavailable' })),
    ]);
  }
}
