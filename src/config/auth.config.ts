import { registerAs } from '@nestjs/config';

export interface AuthConfig {
  accessSecret: string;
  accessExpiresIn: string;
  refreshSecret: string;
  refreshExpiresIn: string;
}

export default registerAs<AuthConfig>('auth', () => ({
  accessSecret: process.env.JWT_ACCESS_SECRET || 'replace-me-access',
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'replace-me-refresh',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
}));
