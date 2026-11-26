import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './controllers/auth.controller.js';
import { AuthService } from './services/auth.service.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { OwnershipService } from './services/ownership.service.js';
import { PasswordService } from './services/password.service.js';
import { RefreshTokenService } from './services/refresh-token.service.js';
import { SecurityEventService } from './security/security-event.service.js';
import { MembersController } from './controllers/members.controller.js';
import { MembersService } from './services/members.service.js';
import { StaffController } from './controllers/staff.controller.js';
import { StaffService } from './services/staff.service.js';
import { WorkoutPlanController } from './controllers/workout-plans.controller.js';
import { WorkoutPlanService } from './services/workout-plans.service.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: '15m',
          algorithm: 'HS256',
        },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [
    AuthController, 
    MembersController, 
    StaffController,
    WorkoutPlanController,
  ],
  providers: [
    SecurityEventService,
    PasswordService,
    RefreshTokenService,
    OwnershipService,
    AuthService,
    MembersService,
    StaffService,
    JwtAuthGuard,
    RolesGuard,
    WorkoutPlanService,
  ],
  exports: [
    JwtModule,
    SecurityEventService,
    PasswordService,
    RefreshTokenService,
    OwnershipService,
    AuthService,
    JwtAuthGuard,
    RolesGuard,
  ],
})
export class AuthModule {}
