import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth-user.interface';

function isAuthenticatedUser(value: unknown): value is AuthenticatedUser {
  if (typeof value !== 'object' || value === null) return false;
  const id = Reflect.get(value, 'id');
  const email = Reflect.get(value, 'email');
  return typeof id === 'string' && typeof email === 'string';
}

/**
 * Resolves the authenticated principal previously attached by JwtStrategy.validate().
 *
 *   getMe(@CurrentUser() user: AuthenticatedUser) {}
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser | undefined => {
    const request = ctx.switchToHttp().getRequest<{ user?: unknown }>();
    return isAuthenticatedUser(request.user) ? request.user : undefined;
  },
);
