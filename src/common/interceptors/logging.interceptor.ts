import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Per-request access log.
 *
 * Format:
 *   HTTP <method> <url> origin=<origin> ip=<ip> -> <status> <ms>ms
 *
 * The origin tag is invaluable when debugging CORS issues with a local frontend.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const httpCtx = context.switchToHttp();
    const req = httpCtx.getRequest<Request>();
    const res = httpCtx.getResponse<Response>();
    const { method, originalUrl } = req;
    const origin = this.headerValue(req.headers.origin) || '-';
    const ip = req.ip || '-';
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - start;
          const status = res.statusCode;
          this.logger.log(
            `${method} ${originalUrl} origin=${origin} ip=${ip} -> ${status} ${ms}ms`,
          );
        },
        error: (err: unknown) => {
          const ms = Date.now() - start;
          const status = this.statusFromError(err) ?? res.statusCode ?? 500;
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `${method} ${originalUrl} origin=${origin} ip=${ip} -> ${status} ${ms}ms (${msg})`,
          );
        },
      }),
    );
  }

  private headerValue(raw: string | string[] | undefined): string | undefined {
    if (Array.isArray(raw)) return raw[0];
    return raw;
  }

  private statusFromError(err: unknown): number | undefined {
    if (err && typeof err === 'object' && 'status' in err) {
      const value = Reflect.get(err, 'status');
      if (typeof value === 'number') return value;
    }
    return undefined;
  }
}
