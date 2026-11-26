import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'refresh_token',
  'refreshtoken',
  'tokenhash',
  'hash',
]);

/** Barreira final: nenhum hash (de senha ou de refresh token) sai na API. */
export function stripSensitiveData<T>(
  value: T,
  clones = new WeakMap<object, unknown>(),
): T {
  if (value === null || typeof value !== 'object' || value instanceof Date) {
    return value;
  }

  if (Array.isArray(value)) {
    const clone: unknown[] = [];
    clones.set(value, clone);
    value.forEach((item) => clone.push(stripSensitiveData(item, clones)));
    return clone as T;
  }

  const existing = clones.get(value);
  if (existing) {
    return existing as T;
  }

  const result: Record<string, unknown> = {};
  clones.set(value, result);
  for (const [key, nested] of Object.entries(value)) {
    if (!SENSITIVE_KEYS.has(key.toLowerCase().replace(/[-_]/g, ''))) {
      result[key] = stripSensitiveData(nested, clones);
    }
  }
  return result as T;
}

@Injectable()
export class SensitiveDataInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => stripSensitiveData(data)));
  }
}
