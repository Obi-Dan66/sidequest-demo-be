import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { buildSwaggerConfig } from './swagger.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: false,
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('app.port') ?? 3000;
  const apiPrefix = config.get<string>('app.apiPrefix') ?? 'api';
  const defaultVersion = config.get<string>('app.apiDefaultVersion') ?? '1';
  const corsOrigins = config.get<string[]>('app.corsOrigins') ?? [];
  const frontendUrl = config.get<string>('app.frontendUrl') ?? '';
  const nodeEnv = config.get<string>('app.nodeEnv') ?? 'development';

  const corsLogger = new Logger('CORS');
  const corsAllowlist = new Set(corsOrigins);

  app.use(helmet());
  app.enableCors({
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Disposition'],
    maxAge: 600,
    origin: (origin, callback) => {
      // Non-browser callers (curl, same-origin server-side) send no Origin header.
      if (!origin) return callback(null, true);
      if (corsAllowlist.has(origin)) return callback(null, true);
      // Deny silently: no Access-Control-Allow-Origin header is sent, so the
      // browser blocks the response client-side. We intentionally do NOT throw
      // here, because throwing turns into a server-side 500 and leaks an error
      // envelope to anyone with a wrong Origin header.
      corsLogger.warn(`Blocked CORS origin: ${origin}`);
      return callback(null, false);
    },
  });

  app.setGlobalPrefix(apiPrefix);
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new ResponseInterceptor());

  app.enableShutdownHooks();

  if (nodeEnv !== 'production') {
    const swaggerConfig = buildSwaggerConfig(defaultVersion);
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(port, '0.0.0.0');

  const logger = new Logger('Bootstrap');
  logger.log(`SideQuest API listening on http://localhost:${port}`);
  logger.log(`Base URL:    http://localhost:${port}/${apiPrefix}/v${defaultVersion}`);
  logger.log(`Health:      http://localhost:${port}/${apiPrefix}/v${defaultVersion}/health`);
  if (nodeEnv !== 'production') {
    logger.log(`Swagger UI:  http://localhost:${port}/${apiPrefix}/docs`);
  }
  if (frontendUrl) {
    logger.log(`Frontend:    ${frontendUrl}`);
  }
  logger.log(`CORS allowlist: ${corsOrigins.length > 0 ? corsOrigins.join(', ') : '(none)'}`);
}

bootstrap().catch((err: unknown) => {
  const logger = new Logger('Bootstrap');
  logger.error('Fatal error during bootstrap', err instanceof Error ? err.stack : String(err));
  process.exit(1);
});
