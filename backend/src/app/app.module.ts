import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthModule } from '../modules/auth/auth.module.js';
import { MembersModule } from '../modules/members/members.module.js';
import { StaffModule } from '../modules/staff/staff.module.js';
import { CheckInsModule } from '../modules/check-ins/check-ins.module.js';
import { WorkoutPlansModule } from '../modules/workout-plans/workout-plans.module.js';
import { CacheModule } from '../infra/cache/cache.module.js';
import { AppConfigModule } from '../infra/config/config.module.js';
import { PrismaModule } from '../infra/database/prisma.module.js';
import { HealthModule } from '../infra/health/health.module.js';
import { AuthGuardsModule } from '../shared/identity/auth-guards.module.js';
import { InputSanitizationMiddleware } from '../shared/middleware/input-sanitization.middleware.js';
import { RequestIdMiddleware } from '../shared/middleware/request-id.middleware.js';
import { ObservabilityModule } from './app.observability.js';

/** Composição da aplicação: infraestrutura, guards globais e módulos de domínio. */
@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    CacheModule,
    AuthGuardsModule,
    AuthModule,
    MembersModule,
    StaffModule,
    WorkoutPlansModule,
    CheckInsModule,
    HealthModule,
    ObservabilityModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(InputSanitizationMiddleware, RequestIdMiddleware)
      .forRoutes('*');
  }
}
