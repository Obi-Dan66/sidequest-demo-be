import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as argon2 from 'argon2';
import { toAppRole } from '../../common/auth/role.mapper';
import { UserDto } from '../users/dto/user.dto';
import { UsersService } from '../users/users.service';
import { AuthTokensDto } from './dto/auth-tokens.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAccessPayload } from './strategies/jwt.strategy';

interface JwtRefreshPayload {
  sub: string;
  tokenType: 'refresh';
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokensDto> {
    const emailExists = await this.usersService.findRawByEmail(dto.email);
    if (emailExists) throw new ConflictException('Email already registered');

    const usernameExists = await this.usersService.findRawByUsername(dto.username);
    if (usernameExists) throw new ConflictException('Username already taken');

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.usersService.createWithCredentials({
      email: dto.email,
      username: dto.username,
      displayName: dto.displayName,
      passwordHash,
    });

    return this.issueTokens(user);
  }

  async login(dto: LoginDto): Promise<AuthTokensDto> {
    const user = await this.usersService.findRawByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (user.status !== 'ACTIVE') throw new UnauthorizedException('Account not active');

    await this.usersService.recordLogin(user.id);
    return this.issueTokens(user);
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.updateRefreshTokenHash(userId, null);
  }

  async refresh(refreshToken: string): Promise<AuthTokensDto> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const user = await this.usersService.findRawById(payload.sub);

    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Refresh token revoked');
    }

    const matches = await argon2.verify(user.refreshTokenHash, refreshToken);
    if (!matches) throw new UnauthorizedException('Refresh token revoked');

    return this.issueTokens(user);
  }

  private async issueTokens(user: User): Promise<AuthTokensDto> {
    const accessPayload: JwtAccessPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      role: toAppRole(user.role),
    };

    const refreshPayload: JwtRefreshPayload = {
      sub: user.id,
      tokenType: 'refresh',
    };

    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.config.get<string>('auth.accessSecret') || 'replace-me-access',
      expiresIn: this.config.get<string>('auth.accessExpiresIn') || '15m',
    });

    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.config.get<string>('auth.refreshSecret') || 'replace-me-refresh',
      expiresIn: this.config.get<string>('auth.refreshExpiresIn') || '7d',
    });

    const refreshTokenHash = await argon2.hash(refreshToken);
    await this.usersService.updateRefreshTokenHash(user.id, refreshTokenHash);

    return {
      accessToken,
      refreshToken,
      user: UserDto.fromEntity(user),
    };
  }

  private async verifyRefreshToken(token: string): Promise<JwtRefreshPayload> {
    try {
      const decoded: unknown = await this.jwt.verifyAsync(token, {
        secret: this.config.get<string>('auth.refreshSecret') || 'replace-me-refresh',
      });
      if (!this.isRefreshPayload(decoded)) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      return decoded;
    } catch (err) {
      this.logger.warn(
        `Refresh token verification failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private isRefreshPayload(value: unknown): value is JwtRefreshPayload {
    if (typeof value !== 'object' || value === null) return false;
    const sub = Reflect.get(value, 'sub');
    const tokenType = Reflect.get(value, 'tokenType');
    return typeof sub === 'string' && tokenType === 'refresh';
  }
}
