import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QuestCategoriesController } from './quest-categories.controller';
import { QuestCategoriesRepository } from './quest-categories.repository';
import { QuestCategoriesService } from './quest-categories.service';
import { QuestCompletionsRepository } from './quest-completions.repository';
import { QuestsController } from './quests.controller';
import { QuestsRepository } from './quests.repository';
import { QuestsService } from './quests.service';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [QuestsController, QuestCategoriesController],
  providers: [
    QuestsService,
    QuestsRepository,
    QuestCompletionsRepository,
    QuestCategoriesService,
    QuestCategoriesRepository,
  ],
  exports: [
    QuestsService,
    QuestsRepository,
    QuestCompletionsRepository,
    QuestCategoriesService,
    QuestCategoriesRepository,
  ],
})
export class QuestsModule {}
