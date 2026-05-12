import { UserRole } from '@prisma/client';
import { AppRole } from './roles.enum';

/**
 * Map the persisted Prisma `UserRole` enum to the API-facing `AppRole`.
 * Keep this isolated so HTTP/DTO code never imports `UserRole` from `@prisma/client`.
 */
export function toAppRole(role: UserRole): AppRole {
  if (role === UserRole.ADMIN) return AppRole.ADMIN;
  if (role === UserRole.MODERATOR) return AppRole.MODERATOR;
  if (role === UserRole.BUSINESS_OWNER) return AppRole.BUSINESS_OWNER;
  return AppRole.USER;
}
