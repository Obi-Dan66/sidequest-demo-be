import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { ApiErrorResponse } from '../responses/api-response';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

interface MappedError {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const mapped = this.mapException(exception);

    const body: ApiErrorResponse = {
      success: false,
      error: {
        code: mapped.code,
        message: mapped.message,
        details: mapped.details,
      },
      meta: {
        path: request.url,
        method: request.method,
        timestamp: new Date().toISOString(),
      },
    };

    if (mapped.status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${mapped.status} ${mapped.code}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} -> ${mapped.status} ${mapped.code}`);
    }

    response.status(mapped.status).json(body);
  }

  private mapException(exception: unknown): MappedError {
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.fromPrismaKnown(exception);
    }
    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        code: 'VALIDATION_ERROR',
        message: 'Invalid query payload',
      };
    }

    const message = exception instanceof Error ? exception.message : 'Internal server error';
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message,
    };
  }

  private fromHttpException(exception: HttpException): MappedError {
    const status = exception.getStatus();
    const raw = exception.getResponse();

    if (typeof raw === 'string') {
      return { status, code: this.codeForStatus(status), message: raw };
    }

    if (isObject(raw)) {
      const messageValue = raw.message;
      const message = Array.isArray(messageValue)
        ? messageValue.join('; ')
        : typeof messageValue === 'string'
          ? messageValue
          : exception.message;

      const codeValue = raw.code;
      const code = typeof codeValue === 'string' ? codeValue : this.codeForStatus(status);

      return {
        status,
        code,
        message,
        details: Array.isArray(messageValue) ? messageValue : undefined,
      };
    }

    return { status, code: this.codeForStatus(status), message: exception.message };
  }

  private fromPrismaKnown(exception: Prisma.PrismaClientKnownRequestError): MappedError {
    switch (exception.code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          code: 'UNIQUE_CONSTRAINT_VIOLATION',
          message: 'A record with the given unique field already exists',
          details: exception.meta,
        };
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          code: 'NOT_FOUND',
          message: 'Requested record was not found',
          details: exception.meta,
        };
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          code: 'FOREIGN_KEY_VIOLATION',
          message: 'Related record is missing or invalid',
          details: exception.meta,
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          code: `PRISMA_${exception.code}`,
          message: 'Database error',
        };
    }
  }

  private codeForStatus(status: number): string {
    if (status === 400) return 'BAD_REQUEST';
    if (status === 401) return 'UNAUTHORIZED';
    if (status === 403) return 'FORBIDDEN';
    if (status === 404) return 'NOT_FOUND';
    if (status === 409) return 'CONFLICT';
    if (status === 422) return 'UNPROCESSABLE_ENTITY';
    if (status === 429) return 'RATE_LIMITED';
    if (status >= 500) return 'INTERNAL_ERROR';
    return 'ERROR';
  }
}
