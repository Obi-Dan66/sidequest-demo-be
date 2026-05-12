import { ApiProperty } from '@nestjs/swagger';

/**
 * Canonical success envelope. Wrapped automatically by ResponseInterceptor.
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

/**
 * Canonical error envelope. Built by GlobalExceptionFilter.
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: Record<string, unknown>;
}

export class PaginationMeta {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;

  @ApiProperty()
  hasNext!: boolean;

  @ApiProperty()
  hasPrev!: boolean;
}

export class PaginatedResult<T> {
  items!: T[];
  pagination!: PaginationMeta;
}

export function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, limit)));
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

export function paginate<T>(
  items: T[],
  page: number,
  limit: number,
  total: number,
): PaginatedResult<T> {
  return {
    items,
    pagination: buildPaginationMeta(page, limit, total),
  };
}
