import { registerAs } from '@nestjs/config';

export interface AppConfig {
  nodeEnv: string;
  port: number;
  name: string;
  url: string;
  apiPrefix: string;
  apiDefaultVersion: string;
  frontendUrl: string;
  corsOrigins: string[];
  throttleTtl: number;
  throttleLimit: number;
  logLevel: string;
}

/**
 * Build the final CORS allowlist as the union of:
 *  - FRONTEND_URL (single primary origin, the value the frontend is actually served from)
 *  - CORS_ORIGINS (extra comma-separated origins for previews / additional dev URLs)
 *
 * In `development`, http://localhost:5173 is always included as a sensible default so
 * a freshly-cloned repo "just works" with the Vite dev server.
 */
function resolveCorsOrigins(env: NodeJS.ProcessEnv): string[] {
  const out = new Set<string>();

  const frontendUrl = (env.FRONTEND_URL || '').trim();
  if (frontendUrl) out.add(frontendUrl);

  for (const piece of (env.CORS_ORIGINS || '').split(',')) {
    const trimmed = piece.trim();
    if (trimmed) out.add(trimmed);
  }

  if ((env.NODE_ENV || 'development') !== 'production') {
    out.add('http://localhost:5173');
    out.add('http://127.0.0.1:5173');
  }

  return Array.from(out);
}

export default registerAs<AppConfig>('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  name: process.env.APP_NAME || 'SideQuest',
  url: process.env.APP_URL || 'http://localhost:3000',
  apiPrefix: process.env.API_PREFIX || 'api',
  apiDefaultVersion: process.env.API_DEFAULT_VERSION || '1',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  corsOrigins: resolveCorsOrigins(process.env),
  throttleTtl: parseInt(process.env.THROTTLE_TTL || '60', 10),
  throttleLimit: parseInt(process.env.THROTTLE_LIMIT || '120', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
}));
