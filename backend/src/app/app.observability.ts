
import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { createObserveModule } from '@nestjs/observe';
import { TerminusModule } from '@nestjs/terminus';
import { getRequestId } from '../shared/middleware/request-id.middleware.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

const loggerModule = LoggerModule.forRoot({
  pinoHttp: {
    genReqId: (req) => getRequestId(req),
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.body.password',
        'req.body.token',
        'req.body.accessToken',
        'req.body.refreshToken',
        'req.cookies',
      ],
      censor: '[REDACTED]',
    },
    serializers: {
      req: (req) => ({ id: req.id, method: req.method, url: req.url }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
    transport:
      process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  },
});

@Module({
  imports: [
    loggerModule,
    TerminusModule,
    ObserveModule.forRoot({
      appKey: process.env.OBSERVE_APP_KEY ?? 'YOUR_APP_KEY',
      appSecret: process.env.OBSERVE_APP_SECRET ?? 'YOUR_APP_SECRET',
      serviceId: 'backend',
    }),
  ],
  exports: [
    loggerModule,
    TerminusModule,
    ObserveModule,
  ],
})
export class ObservabilityModule {}
