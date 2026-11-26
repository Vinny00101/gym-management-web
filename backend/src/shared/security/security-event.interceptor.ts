import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { catchError, Observable, throwError } from 'rxjs';
import { SecurityEventService } from './security-event.service.js';

/**
 * Os guards já registram seus 401/403. Este interceptor cobre as negativas
 * lançadas por services (por exemplo, a checagem de posse), que acontecem
 * depois dos guards e antes de chegar ao filtro global.
 */
@Injectable()
export class SecurityEventInterceptor implements NestInterceptor {
  constructor(private readonly securityEvents: SecurityEventService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((error: unknown) => {
        if (
          error instanceof HttpException &&
          (error.getStatus() === HttpStatus.UNAUTHORIZED ||
            error.getStatus() === HttpStatus.FORBIDDEN)
        ) {
          const request = context.switchToHttp().getRequest<Request>();
          this.securityEvents.accessDenied(
            request,
            `status:${error.getStatus()}`,
          );
        }
        return throwError(() => error);
      }),
    );
  }
}
