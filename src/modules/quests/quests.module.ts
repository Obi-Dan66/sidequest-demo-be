import { Module } from '@nestjs/common';
import { QuestCompletionsRepository } from './quest-completions.repository';
import { QuestsController } from './quests.controller';
import { QuestsRepository } from './quests.repository';
import { QuestsService } from './quests.service';

@Module({
  controllers: [QuestsController],
  providers: [QuestsService, QuestsRepository, QuestCompletionsRepository],
  exports: [QuestsService, QuestsRepository, QuestCompletionsRepository],
})
export class QuestsModule {}
