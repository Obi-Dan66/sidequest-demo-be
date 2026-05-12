/**
 * Generates a checked-in `openapi.yaml` from the live Nest controllers / DTOs.
 *
 * Invoked automatically by the husky pre-commit hook so the spec on disk never
 * drifts from the running API. Can also be run manually:
 *
 *   yarn openapi:generate
 *
 * To keep the hook fast and independent of local infra, this boots AppModule
 * with `SKIP_PRISMA_CONNECT=1` and the Nest logger disabled - no DB, no
 * websocket binding, no third-party network calls happen.
 */

// Must be set BEFORE AppModule (and therefore PrismaService) is imported,
// because @Injectable side-effects can read env at decoration time.
process.env.SKIP_PRISMA_CONNECT = '1';
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { stringify as yamlStringify } from 'yaml';
import { AppModule } from '../src/app.module';
import { buildSwaggerConfig } from '../src/swagger.config';

async function generateOpenAPI(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });

  const config = app.get(ConfigService);
  const apiPrefix = config.get<string>('app.apiPrefix') ?? 'api';
  const defaultVersion = config.get<string>('app.apiDefaultVersion') ?? '1';

  app.setGlobalPrefix(apiPrefix);
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion,
  });

  const swaggerConfig = buildSwaggerConfig(defaultVersion);
  const document = SwaggerModule.createDocument(app, swaggerConfig);

  const outputPath = join(process.cwd(), 'openapi.yaml');
  const yamlContent = yamlStringify(document, {
    lineWidth: 0,
    aliasDuplicateObjects: false,
  });
  writeFileSync(outputPath, yamlContent, 'utf-8');

  await app.close();

  process.stdout.write(`OpenAPI spec written to ${outputPath}\n`);
}

generateOpenAPI().catch((err: unknown) => {
  const message = err instanceof Error ? err.stack || err.message : String(err);
  process.stderr.write(`Failed to generate OpenAPI spec: ${message}\n`);
  process.exit(1);
});
