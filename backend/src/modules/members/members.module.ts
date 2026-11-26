import { Module } from '@nestjs/common';
import { PasswordModule } from '../auth/password.module.js';
import { MembersController } from './members.controller.js';
import { MembersService } from './members.service.js';

/** RF03–RF07: cadastro, listagem, edição e vínculo de instrutor. */
@Module({
  imports: [PasswordModule],
  controllers: [MembersController],
  providers: [MembersService],
})
export class MembersModule {}
