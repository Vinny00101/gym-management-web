import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { NextFunction, Request, Response } from 'express';

export function getRequestId(req: Request | IncomingMessage): string {
  const headerId = req.headers['x-request-id'];
  const existingId = Array.isArray(headerId) ? headerId[0] : headerId;
  const requestId =
    existingId?.toString() ||
    (req as IncomingMessage & { id?: string }).id ||
    randomUUID();

  req.headers['x-request-id'] = requestId;
  return requestId;
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    res.setHeader('X-Request-Id', getRequestId(req));
    next();
  }
}
