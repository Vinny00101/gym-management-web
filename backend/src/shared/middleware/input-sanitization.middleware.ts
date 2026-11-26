import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeString(value: string): string {
  return value
    .split('')
    .filter((character) => {
      const code = character.charCodeAt(0);
      return !(code <= 0x1f || (code >= 0x7f && code <= 0x9f));
    })
    .join('')
    .trim();
}

export function sanitizeInput(value: unknown): unknown {
  if (typeof value === 'string') {
    return sanitizeString(value);
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeInput);
  }

  if (isRecord(value)) {
    for (const [key, nestedValue] of Object.entries(value)) {
      value[key] = sanitizeInput(nestedValue);
    }
  }

  return value;
}

@Injectable()
export class InputSanitizationMiddleware implements NestMiddleware {
  use(request: Request, _response: Response, next: NextFunction): void {
    request.body = sanitizeInput(request.body);

    const query = sanitizeInput(request.query);
    Object.defineProperty(request, 'query', {
      configurable: true,
      enumerable: true,
      value: query,
      writable: true,
    });

    next();
  }
}
