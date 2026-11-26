import { Module } from '@nestjs/common';
import { PasswordService } from './password.service.js';

/** Hash de senha (RNF05), compartilhado com os cadastros de staff e members. */
@Module({
  providers: [PasswordService],
  exports: [PasswordService],
})
export class PasswordModule {}
