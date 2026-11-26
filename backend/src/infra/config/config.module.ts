import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import Joi from 'joi';
import { resolve } from 'node:path';

/**
 * Schema compartilhado por todas as formas de inicializar a aplicação.
 *
 * `REDIS_URL` é opcional no schema porque os testes e2e usam store em memória;
 * a obrigatoriedade fora de `NODE_ENV=test` é verificada por `infra/cache`.
 */
export const envValidationSchema = Joi.object({
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string().required().messages({
    'any.required': 'DATABASE_URL is required',
    'string.empty': 'DATABASE_URL is required',
  }),
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  REDIS_URL: Joi.string().uri({ scheme: ['redis', 'rediss'] }).messages({
    'string.uri': 'REDIS_URL must be a redis:// or rediss:// URL',
    'string.empty': 'REDIS_URL cannot be empty',
  }),
  CACHE_TTL: Joi.number().integer().positive().default(300_000),
  JWT_SECRET: Joi.string().required().messages({
    'any.required': 'JWT_SECRET is required',
    'string.empty': 'JWT_SECRET is required',
  }),
  JWT_EXPIRES_IN: Joi.string().valid('15m').required().messages({
    'any.required': 'JWT_EXPIRES_IN is required',
    'string.empty': 'JWT_EXPIRES_IN is required',
    'any.only': 'JWT_EXPIRES_IN must be 15m',
  }),
  REFRESH_TOKEN_EXPIRES_IN: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .required()
    .messages({
      'any.required': 'REFRESH_TOKEN_EXPIRES_IN is required',
      'string.empty': 'REFRESH_TOKEN_EXPIRES_IN is required',
      'string.pattern.base':
        'REFRESH_TOKEN_EXPIRES_IN must look like 7d or 60m',
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
});

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        resolve(process.cwd(), '../.env'),
        resolve(process.cwd(), '.env'),
      ],
      validationSchema: envValidationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      } as any,
    }),
  ],
})
export class AppConfigModule {}
