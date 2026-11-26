import { Module } from '@nestjs/common';
import { PasswordModule } from '../auth/password.module.js';
import { StaffController } from './staff.controller.js';
import { StaffService } from './staff.service.js';

/** RF02: cadastro de instrutores e administradores pelo admin. */
@Module({
  imports: [PasswordModule],
  controllers: [StaffController],
  providers: [StaffService],
})
export class StaffModule {}
