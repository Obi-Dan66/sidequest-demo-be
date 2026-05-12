import { AppRole } from './roles.enum';

/**
 * Shape of the authenticated principal attached to `req.user` by JwtStrategy.
 * Keep small - this is hot-path data carried in JWT.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  username: string;
  role: AppRole;
}
