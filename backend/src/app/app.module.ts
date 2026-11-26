import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthGuardsModule } from '../auth-guards.module.js';
import { CacheModule } from '../infra/cache/cache.module.js';
import { AppConfigModule } from '../infra/config/config.module.js';
import { PrismaModule } from '../infra/database/prisma.module.js';
import { HealthModule } from '../infra/health/health.module.js';
import { LoggingModule } from '../infra/logging/logging.module.js';
import { ObservabilityModule } from '../infra/observability/observability.module.js';
import { InputSanitizationMiddleware } from '../middleware/input-sanitization.middleware.js';
import { RequestIdMiddleware } from '../middleware/request-id.middleware.js';

/**
 * Composição da aplicação: infraestrutura isolada, guards globais e (no T5)
 * módulos por domínio. A pipeline HTTP compartilhada está em `setup-app.ts`.
 */
@Module({
  imports: [
    AppConfigModule,
    LoggingModule,
    PrismaModule,
    CacheModule,
    AuthGuardsModule,
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
