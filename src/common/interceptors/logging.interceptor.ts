import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<Request>();
    const { method, url } = req;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - start;
          this.logger.log(`${method} ${url} -> OK ${ms}ms`);
        },
        error: (err: unknown) => {
          const ms = Date.now() - start;
          const status =
            err && typeof err === 'object' && 'status' in err && typeof err.status === 'number'
              ? err.status
              : 500;
          this.logger.warn(`${method} ${url} -> ${status} ${ms}ms`);
        },
      }),
    );
  }
}
