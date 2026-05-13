import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import appConfig from './config/app.config';
import authConfig from './config/auth.config';
import databaseConfig from './config/database.config';
import { validateEnv } from './config/env.validation';
import geoConfig from './config/geo.config';
import notificationsConfig from './config/notifications.config';
import redisConfig from './config/redis.config';
import uploadsConfig from './config/uploads.config';
import { LastSeenAtInterceptor } from './common/interceptors/last-seen-at.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PrismaModule } from './prisma/prisma.module';
import { AchievementsModule } from './modules/achievements/achievements.module';
import { AuthModule } from './modules/auth/auth.module';
import { BusinessesModule } from './modules/businesses/businesses.module';
import { EventsModule } from './modules/events/events.module';
import { FriendshipsModule } from './modules/friendships/friendships.module';
import { GeoModule } from './modules/geo/geo.module';
import { HealthModule } from './modules/health/health.module';
import { LeaderboardModule } from './modules/leaderboard/leaderboard.module';
import { StatsModule } from './modules/stats/stats.module';
import { MapModule } from './modules/map/map.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { QuestsModule } from './modules/quests/quests.module';
import { SchedulesModule } from './modules/schedules/schedules.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      load: [
        appConfig,
        authConfig,
        databaseConfig,
        geoConfig,
        notificationsConfig,
        redisConfig,
        uploadsConfig,
      ],
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: (config.get<number>('app.throttleTtl') ?? 60) * 1000,
          limit: config.get<number>('app.throttleLimit') ?? 120,
        },
      ],
    }),

    PrismaModule,
    EventsModule,
    GeoModule,

    AuthModule,
    UsersModule,
    QuestsModule,
    AchievementsModule,
    MapModule,
    FriendshipsModule,
    BusinessesModule,
    NotificationsModule,
    LeaderboardModule,
    StatsModule,
    UploadsModule,
    HealthModule,
    SchedulesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: LastSeenAtInterceptor },
  ],
})
export class AppModule {}
