import { Module } from '@nestjs/common';
import { AchievementsController } from './achievements.controller';
import { AchievementsRepository } from './achievements.repository';
import { AchievementsService } from './achievements.service';

@Module({
  controllers: [AchievementsController],
  providers: [AchievementsService, AchievementsRepository],
  exports: [AchievementsService, AchievementsRepository],
})
export class AchievementsModule {}
