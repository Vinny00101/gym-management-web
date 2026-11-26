import { envValidationSchema } from './config.module.js';

const validEnv = {
  DATABASE_URL: 'postgresql://user:password@localhost:5432/gym_management',
  JWT_SECRET: 'integration-test-secret-with-more-than-32-chars',
  JWT_EXPIRES_IN: '15m',
  REFRESH_TOKEN_EXPIRES_IN: '7d',
  ADMIN_EMAIL: 'admin@example.com',
  ADMIN_NAME: 'Administrador',
  ADMIN_PASSWORD: 'change-me',
};

describe('config validation', () => {
  it('aplica o TTL padrão de cache em milissegundos', () => {
    const { error, value } = envValidationSchema.validate(validEnv);

    expect(error).toBeUndefined();
    expect(value.CACHE_TTL).toBe(300_000);
  });

  it('aceita e valida URLs Redis', () => {
    expect(
      envValidationSchema.validate({
        ...validEnv,
        REDIS_URL: 'rediss://:secret@cache.example.com:6380',
      }).error,
    ).toBeUndefined();

    const { error } = envValidationSchema.validate({
      ...validEnv,
      REDIS_URL: 'http://localhost:6379',
    });

    expect(error?.message).toContain('REDIS_URL');
  });

  it('aceita CACHE_TTL explícito', () => {
    const { error, value } = envValidationSchema.validate({
      ...validEnv,
      CACHE_TTL: 60_000,
    });

    expect(error).toBeUndefined();
    expect(value.CACHE_TTL).toBe(60_000);
  });
});
