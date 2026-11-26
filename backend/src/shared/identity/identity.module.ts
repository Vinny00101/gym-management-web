import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { SecurityModule } from '../security/security.module.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { OwnershipService } from './ownership.service.js';

/**
 * Identidade e autorização compartilhadas por todos os domínios.
 * A configuração do JWT fica aqui — o módulo de auth apenas consome o
 * `JwtService` exportado.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '15m', algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
    SecurityModule,
  ],
  providers: [JwtAuthGuard, RolesGuard, OwnershipService],
  exports: [
    JwtModule,
    SecurityModule,
    JwtAuthGuard,
    RolesGuard,
    OwnershipService,
  ],
})
export class IdentityModule {}
