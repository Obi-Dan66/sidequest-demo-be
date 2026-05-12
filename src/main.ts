import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: false,
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('app.port') ?? 3000;
  const apiPrefix = config.get<string>('app.apiPrefix') ?? 'api';
  const defaultVersion = config.get<string>('app.apiDefaultVersion') ?? '1';
  const corsOrigins = config.get<string[]>('app.corsOrigins') ?? [];
  const nodeEnv = config.get<string>('app.nodeEnv') ?? 'development';

  app.use(helmet());
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
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
    const swaggerConfig = new DocumentBuilder()
      .setTitle('SideQuest API')
      .setDescription('Gamified exploration platform - REST API')
      .setVersion(defaultVersion)
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Paste the access token returned by /auth/login',
        },
        'access-token',
      )
      .addTag('auth')
      .addTag('users')
      .addTag('quests')
      .addTag('achievements')
      .addTag('map')
      .addTag('friendships')
      .addTag('businesses')
      .addTag('notifications')
      .addTag('uploads')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(port, '0.0.0.0');

  const logger = new Logger('Bootstrap');
  logger.log(`SideQuest API listening on port ${port}`);
  logger.log(`Base URL: /${apiPrefix}/v${defaultVersion}`);
  if (nodeEnv !== 'production') {
    logger.log(`Swagger UI: /${apiPrefix}/docs`);
  }
}

bootstrap().catch((err: unknown) => {
  const logger = new Logger('Bootstrap');
  logger.error('Fatal error during bootstrap', err instanceof Error ? err.stack : String(err));
  process.exit(1);
});
