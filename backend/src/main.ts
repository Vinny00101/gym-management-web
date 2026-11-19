import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule, ObserveInstrument } from './app.module.js';
import { configureHttp } from './http/configure-http.js';
import { configureValidation } from './validation/configure-validation.js';
import { ApiExceptionFilter } from './filters/api-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  configureHttp(app);
  configureValidation(app);
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
