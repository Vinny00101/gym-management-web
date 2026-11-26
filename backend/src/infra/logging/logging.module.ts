import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { getRequestId } from '../../middleware/request-id.middleware.js';

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
  imports: [loggerModule],
  exports: [loggerModule],
})
export class LoggingModule {}
