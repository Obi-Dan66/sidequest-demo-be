import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

function passportInfoMessage(info: unknown): string | undefined {
  if (typeof info !== 'object' || info === null) return undefined;
  const message = Reflect.get(info, 'message');
  return typeof message === 'string' && message.length > 0 ? message : undefined;
}

/**
 * Default global guard. Routes opt out via `@Public()`.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  handleRequest<TUser>(
    err: unknown,
    user: TUser,
    info: unknown,
    _context: ExecutionContext,
    _status?: unknown,
  ): TUser {
    if (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      const fromErr = err instanceof Error ? err.message : undefined;
      throw new UnauthorizedException(
        fromErr !== undefined && fromErr.length > 0 ? fromErr : 'Unauthorized',
      );
    }
    if (!user) {
      const fromInfo = passportInfoMessage(info);
      throw new UnauthorizedException(
        fromInfo !== undefined ? fromInfo : 'Missing or invalid bearer token',
      );
    }
    return user;
  }
}
