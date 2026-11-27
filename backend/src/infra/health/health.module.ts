import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { ObserveModule } from '../../app/app.observability.js';

@Module({
  imports: [ObserveModule],
  controllers: [HealthController],
})
export class HealthModule {}
