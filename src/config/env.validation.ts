import { plainToInstance } from 'class-transformer';
import {
  IsBooleanString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

export enum NodeEnvironment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvVariables {
  @IsEnum(NodeEnvironment)
  NODE_ENV: NodeEnvironment = NodeEnvironment.Development;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  APP_NAME: string = 'SideQuest';

  @IsString()
  APP_URL: string = 'http://localhost:3000';

  @IsString()
  API_PREFIX: string = 'api';

  @IsString()
  API_DEFAULT_VERSION: string = '1';

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  JWT_ACCESS_EXPIRES_IN: string = '15m';

  @IsString()
  JWT_REFRESH_SECRET!: string;

  @IsString()
  JWT_REFRESH_EXPIRES_IN: string = '7d';

  @IsOptional()
  @IsString()
  LOG_LEVEL?: string;

  @IsOptional()
  @IsString()
  FRONTEND_URL?: string;

  @IsOptional()
  @IsString()
  CORS_ORIGINS?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  THROTTLE_TTL?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  THROTTLE_LIMIT?: number;

  @IsOptional()
  @IsString()
  GEO_DEFAULT_LAT?: string;

  @IsOptional()
  @IsString()
  GEO_DEFAULT_LNG?: string;

  @IsOptional()
  @IsInt()
  GEO_DEFAULT_RADIUS_METERS?: number;

  @IsOptional()
  @IsString()
  UPLOAD_DIR?: string;

  @IsOptional()
  @IsInt()
  UPLOAD_MAX_FILE_SIZE_MB?: number;

  @IsOptional()
  @IsString()
  REDIS_HOST?: string;

  @IsOptional()
  @IsInt()
  REDIS_PORT?: number;

  @IsOptional()
  @IsBooleanString()
  NOTIFICATIONS_ENABLED?: string;
}

export function validateEnv(config: Record<string, unknown>): EnvVariables {
  const validated = plainToInstance(EnvVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
    whitelist: false,
  });

  if (errors.length > 0) {
    const messages = errors
      .map((e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${messages}`);
  }

  return validated;
}
