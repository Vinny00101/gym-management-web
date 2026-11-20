import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';
import { AppModule, ObserveInstrument } from './app.module.js';
import { ApiExceptionFilter } from './filters/api-exception.filter.js';
import { SensitiveDataInterceptor } from './http/sensitive-data.interceptor.js';
import { configureHttp } from './http/configure-http.js';
import { configureValidation } from './validation/configure-validation.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    instrument: ObserveInstrument,
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  app.set('trust proxy', 'loopback');
  app.use(cookieParser());
  configureHttp(app);
  configureValidation(app);
  app.useGlobalInterceptors(new SensitiveDataInterceptor());
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
