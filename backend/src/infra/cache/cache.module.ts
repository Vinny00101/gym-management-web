import {
  CacheModule as NestCacheModule,
  type CacheModuleOptions,
} from '@nestjs/cache-manager';
import { Module, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createKeyv } from '@keyv/redis';
import { KeyvCacheableMemory } from 'cacheable';
import { Keyv } from 'keyv';
import { AppConfigModule } from '../config/config.module.js';

type CacheStores = NonNullable<CacheModuleOptions['stores']>;
type RedisStoreFactory = (url: string) => Keyv;
type ErrorLogger = Pick<Logger, 'error'>;

function memoryStore(ttl: number): Keyv {
  return new Keyv({ store: new KeyvCacheableMemory({ ttl, lruSize: 5000 }) });
}

/**
 * Store Redis compartilhado entre instâncias, com memória como fallback.
 * Em testes, só a memória é usada: os e2e não devem exigir um Redis de pé.
 */
export function createCacheOptions(
  configService: ConfigService,
  dependencies: {
    createRedisStore?: RedisStoreFactory;
    logger?: ErrorLogger;
  } = {},
): CacheModuleOptions {
  const ttl = configService.getOrThrow<number>('CACHE_TTL');
  const environment = configService.get<string>('NODE_ENV');
  const redisUrl = configService.get<string>('REDIS_URL');
  const createRedisStore = dependencies.createRedisStore ?? createKeyv;
  const logger = dependencies.logger ?? new Logger('CacheModule');

  if (environment === 'test') {
    return { ttl, stores: [memoryStore(ttl)] as unknown as CacheStores };
  }

  if (!redisUrl) {
    throw new Error('REDIS_URL is required when NODE_ENV is not "test"');
  }

  const redisStore = createRedisStore(redisUrl);
  // Keyv lança se o store emitir `error` sem listener e derruba o processo.
  redisStore.on('error', (error: unknown) => {
    logger.error(
      'Redis cache store error',
      error instanceof Error ? (error.stack ?? error.message) : String(error),
    );
  });

  return {
    ttl,
    stores: [redisStore, memoryStore(ttl)] as unknown as CacheStores,
  };
}

@Module({
  imports: [
    NestCacheModule.registerAsync({
      isGlobal: true,
      imports: [AppConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        createCacheOptions(configService),
    }),
  ],
})
export class CacheModule {}
