import { Module } from '@nestjs/common';
import { SecurityEventService } from './security-event.service.js';

/** Eventos de segurança (RNF10), disponíveis para guards, services e setupApp. */
@Module({
  providers: [SecurityEventService],
  exports: [SecurityEventService],
})
export class SecurityModule {}
