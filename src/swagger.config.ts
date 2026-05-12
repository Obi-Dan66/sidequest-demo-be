import { DocumentBuilder } from '@nestjs/swagger';

/**
 * Single source of truth for the SideQuest OpenAPI document.
 *
 * Consumed by:
 *  - `src/main.ts`              - to mount the live Swagger UI at /api/docs
 *  - `scripts/generate-openapi` - to produce a checked-in openapi.yaml on every commit
 *
 * Keep the tag list, auth schemes, and metadata here so both surfaces always agree.
 */
export function buildSwaggerConfig(version: string): ReturnType<DocumentBuilder['build']> {
  return new DocumentBuilder()
    .setTitle('SideQuest API')
    .setDescription('Gamified exploration platform - REST API')
    .setVersion(version)
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
    .addTag('health')
    .build();
}
