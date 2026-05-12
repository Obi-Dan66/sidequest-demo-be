import { SetMetadata } from '@nestjs/common';
import { AppRole } from '../auth/roles.enum';

export const ROLES_KEY = 'roles';

/**
 * Restricts a route to listed roles. Used in combination with RolesGuard.
 *
 *   @Roles(AppRole.ADMIN, AppRole.MODERATOR)
 */
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
