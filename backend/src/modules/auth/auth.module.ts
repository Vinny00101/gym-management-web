import { Module } from '@nestjs/common';
import { IdentityModule } from '../../shared/identity/identity.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PasswordModule } from './password.module.js';
import { RefreshTokenService } from './refresh-token.service.js';

/** RF01 e RNF06/RNF14: login, refresh, logout e senha. */
@Module({
  imports: [IdentityModule, PasswordModule],
  controllers: [AuthController],
  providers: [AuthService, RefreshTokenService],
  exports: [PasswordModule],
})
export class AuthModule {}
