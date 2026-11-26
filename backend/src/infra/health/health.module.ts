import { Module } from '@nestjs/common';
import { ObservabilityModule } from '../observability/observability.module.js';
import { HealthController } from './health.controller.js';

@Module({
  imports: [ObservabilityModule],
  controllers: [HealthController],
})
export class HealthModule {}
