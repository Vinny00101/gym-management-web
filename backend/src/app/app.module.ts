import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthModule } from '../modules/auth/auth.module.js';
import { MembersModule } from '../modules/members/members.module.js';
import { StaffModule } from '../modules/staff/staff.module.js';
import { WorkoutPlansModule } from '../modules/workout-plans/workout-plans.module.js';
import { CacheModule } from '../infra/cache/cache.module.js';
import { AppConfigModule } from '../infra/config/config.module.js';
import { PrismaModule } from '../infra/database/prisma.module.js';
import { HealthModule } from '../infra/health/health.module.js';
import { LoggingModule } from '../infra/logging/logging.module.js';
import { ObservabilityModule } from '../infra/observability/observability.module.js';
import { AuthGuardsModule } from '../shared/identity/auth-guards.module.js';
import { InputSanitizationMiddleware } from '../shared/middleware/input-sanitization.middleware.js';
import { RequestIdMiddleware } from '../shared/middleware/request-id.middleware.js';

/** Composição da aplicação: infraestrutura, guards globais e módulos de domínio. */
@Module({
  imports: [
    AppConfigModule,
    LoggingModule,
    PrismaModule,
    CacheModule,
    AuthGuardsModule,
    AuthModule,
    MembersModule,
    StaffModule,
    WorkoutPlansModule,
    ObservabilityModule,
    HealthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(InputSanitizationMiddleware, RequestIdMiddleware)
      .forRoutes('*');
  }
}
