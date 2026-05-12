import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiSuccessResponse } from '../responses/api-response';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAlreadyEnveloped(value: unknown): value is ApiSuccessResponse<unknown> {
  return isObject(value) && value.success === true && 'data' in value;
}

function isPaginatedShape(
  value: unknown,
): value is { items: unknown[]; pagination: Record<string, unknown> } {
  return isObject(value) && Array.isArray(value.items) && isObject(value.pagination);
}

/**
 * Wraps every controller response in the canonical success envelope:
 *   { success: true, data: <payload>, meta?: {...} }
 *
 * - If a handler already returned the envelope, it is passed through.
 * - If the payload is `{ items, pagination }`, the pagination object is hoisted to `meta`.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiSuccessResponse<unknown>> {
  intercept(_ctx: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccessResponse<unknown>> {
    return next.handle().pipe(
      map((payload) => {
        if (isAlreadyEnveloped(payload)) {
          return payload;
        }

        if (isPaginatedShape(payload)) {
          return {
            success: true,
            data: payload.items,
            meta: { pagination: payload.pagination },
          };
        }

        return { success: true, data: payload };
      }),
    );
  }
}
