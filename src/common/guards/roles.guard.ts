import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppRole } from '../auth/roles.enum';
import { AuthenticatedUser } from '../auth/auth-user.interface';
import { ROLES_KEY } from '../decorators/roles.decorator';

function isAuthenticatedUser(value: unknown): value is AuthenticatedUser {
  if (typeof value !== 'object' || value === null) return false;
  const id = Reflect.get(value, 'id');
  const role = Reflect.get(value, 'role');
  return typeof id === 'string' && typeof role === 'string';
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AppRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user?: unknown }>();
    if (!isAuthenticatedUser(request.user)) {
      throw new ForbiddenException('No authenticated principal');
    }

    if (!required.includes(request.user.role)) {
      throw new ForbiddenException('Insufficient role');
    }

    return true;
  }
}
