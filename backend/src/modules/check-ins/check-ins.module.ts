import { Module } from '@nestjs/common';
import { CheckInsController } from './check-ins.controller.js';
import { CheckInsService } from './check-ins.service.js';

/** RF13: registro de entrada dos membros. */
@Module({
  controllers: [CheckInsController],
  providers: [CheckInsService],
})
export class CheckInsModule {}
