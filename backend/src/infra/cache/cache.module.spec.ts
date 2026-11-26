import { ConfigService } from '@nestjs/config';
import type { Keyv } from 'keyv';
import { createCacheOptions } from './cache.module.js';

function config(values: Record<string, unknown>): ConfigService {
  return {
    get: (key: string) => values[key],
    getOrThrow: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('CacheModule options', () => {
  it('usa somente memória em testes, sem exigir REDIS_URL', () => {
    const options = createCacheOptions(
      config({ NODE_ENV: 'test', CACHE_TTL: 60_000 }),
    );

    expect(options.ttl).toBe(60_000);
    expect(options.stores).toHaveLength(1);
  });

  it('usa Redis com fallback em memória fora de testes', () => {
    const on = vi.fn();
    const redisStore = { on } as unknown as Keyv;
    const logger = { error: vi.fn() };

    const options = createCacheOptions(
      config({
        NODE_ENV: 'production',
        CACHE_TTL: 300_000,
        REDIS_URL: 'redis://localhost:6379',
      }),
      { createRedisStore: () => redisStore, logger },
    );

    expect(options.stores).toHaveLength(2);
    expect(on).toHaveBeenCalledWith('error', expect.any(Function));

    const handler = on.mock.calls[0][1] as (error: Error) => void;
    handler(new Error('connection lost'));
    expect(logger.error).toHaveBeenCalledWith(
      'Redis cache store error',
      expect.stringContaining('connection lost'),
    );
  });

  it('falha no bootstrap sem REDIS_URL fora de testes', () => {
    expect(() =>
      createCacheOptions(config({ NODE_ENV: 'development', CACHE_TTL: 1 })),
    ).toThrow('REDIS_URL is required');
  });
});
