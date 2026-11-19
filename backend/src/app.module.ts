import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { createObserveModule } from '@nestjs/observe';
import { TerminusModule } from '@nestjs/terminus';
import { LoggerModule } from 'nestjs-pino';
import Joi from 'joi';
import { resolve } from 'node:path';
import { AppController } from './controllers/app.controller.js';
import { HealthController } from './controllers/health.controller.js';
import { AppService } from './services/app.service.js';
import { InputSanitizationMiddleware } from './middleware/input-sanitization.middleware.js';
import { PrismaModule } from './prisma/prisma.module.js';
import {
  getRequestId,
  RequestIdMiddleware,
} from './middleware/request-id.middleware.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        resolve(process.cwd(), '../.env'),
        resolve(process.cwd(), '.env'),
      ],
      validationSchema: Joi.object({
        PORT: Joi.number().port().default(3000),
        DATABASE_URL: Joi.string().required().messages({
          'any.required': 'DATABASE_URL is required',
          'string.empty': 'DATABASE_URL is required',
        }),
        JWT_SECRET: Joi.string().required().messages({
          'any.required': 'JWT_SECRET is required',
          'string.empty': 'JWT_SECRET is required',
        }),
        JWT_EXPIRES_IN: Joi.string().required().messages({
          'any.required': 'JWT_EXPIRES_IN is required',
          'string.empty': 'JWT_EXPIRES_IN is required',
        }),
        REFRESH_TOKEN_EXPIRES_IN: Joi.string().required().messages({
          'any.required': 'REFRESH_TOKEN_EXPIRES_IN is required',
          'string.empty': 'REFRESH_TOKEN_EXPIRES_IN is required',
        }),
        ADMIN_EMAIL: Joi.string().email().required().messages({
          'any.required': 'ADMIN_EMAIL is required',
          'string.empty': 'ADMIN_EMAIL is required',
          'string.email': 'ADMIN_EMAIL must be a valid email',
        }),
        ADMIN_NAME: Joi.string().required().messages({
          'any.required': 'ADMIN_NAME is required',
          'string.empty': 'ADMIN_NAME is required',
        }),
        ADMIN_PASSWORD: Joi.string().required().messages({
          'any.required': 'ADMIN_PASSWORD is required',
          'string.empty': 'ADMIN_PASSWORD is required',
        }),
      }),
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      } as any,
    }),
    LoggerModule.forRoot({
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
          ],
          censor: '[REDACTED]',
        },
        serializers: {
          req: (req) => ({
            id: req.id,
            method: req.method,
            url: req.url,
          }),
          res: (res) => ({
            statusCode: res.statusCode,
          }),
        },
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
      },
    }),
    PrismaModule,
    TerminusModule,
    ObserveModule.forRoot({
      appKey: process.env.OBSERVE_APP_KEY ?? 'YOUR_APP_KEY',
      appSecret: process.env.OBSERVE_APP_SECRET ?? 'YOUR_APP_SECRET',
      serviceId: 'backend',
    }),
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(InputSanitizationMiddleware, RequestIdMiddleware)
      .forRoutes('*');
  }
}
