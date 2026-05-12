import { Module } from '@nestjs/common';
import { QuestsModule } from '../quests/quests.module';
import { AchievementsController } from './achievements.controller';
import { AchievementsRepository } from './achievements.repository';
import { AchievementsService } from './achievements.service';

@Module({
  imports: [QuestsModule],
  controllers: [AchievementsController],
  providers: [AchievementsService, AchievementsRepository],
  exports: [AchievementsService, AchievementsRepository],
})
export class AchievementsModule {}
