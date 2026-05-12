import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '../../../common/auth/auth-user.interface';
import { toAppRole } from '../../../common/auth/role.mapper';
import { AppRole } from '../../../common/auth/roles.enum';
import { UsersService } from '../../users/users.service';

export interface JwtAccessPayload {
  sub: string;
  email: string;
  username: string;
  role: AppRole;
}

function isJwtAccessPayload(value: unknown): value is JwtAccessPayload {
  if (typeof value !== 'object' || value === null) return false;
  const sub = Reflect.get(value, 'sub');
  const email = Reflect.get(value, 'email');
  const username = Reflect.get(value, 'username');
  const role = Reflect.get(value, 'role');
  return (
    typeof sub === 'string' &&
    typeof email === 'string' &&
    typeof username === 'string' &&
    typeof role === 'string'
  );
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('auth.accessSecret') || 'replace-me-access',
    });
  }

  async validate(payload: unknown): Promise<AuthenticatedUser> {
    if (!isJwtAccessPayload(payload)) {
      throw new UnauthorizedException('Malformed token payload');
    }

    const user = await this.usersService.findRawById(payload.sub);
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User not active');
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: toAppRole(user.role),
    };
  }
}
