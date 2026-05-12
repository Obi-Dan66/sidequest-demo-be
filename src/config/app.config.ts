import { registerAs } from '@nestjs/config';

export interface AppConfig {
  nodeEnv: string;
  port: number;
  name: string;
  url: string;
  apiPrefix: string;
  apiDefaultVersion: string;
  corsOrigins: string[];
  throttleTtl: number;
  throttleLimit: number;
  logLevel: string;
}

export default registerAs<AppConfig>('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  name: process.env.APP_NAME || 'SideQuest',
  url: process.env.APP_URL || 'http://localhost:3000',
  apiPrefix: process.env.API_PREFIX || 'api',
  apiDefaultVersion: process.env.API_DEFAULT_VERSION || '1',
  corsOrigins: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  throttleTtl: parseInt(process.env.THROTTLE_TTL || '60', 10),
  throttleLimit: parseInt(process.env.THROTTLE_LIMIT || '120', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
}));
