import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ParticipantSummaryDto } from '../../../common/dto/participant-summary.dto';

export enum FriendActivityKind {
  QuestCompleted = 'QUEST_COMPLETED',
  QuestStarted = 'QUEST_STARTED',
  AchievementUnlocked = 'ACHIEVEMENT_UNLOCKED',
  LevelUp = 'LEVEL_UP',
  PlaceVisited = 'PLACE_VISITED',
}

export class FriendActivityDto {
  @ApiProperty() id!: string;

  @ApiProperty({ enum: FriendActivityKind, enumName: 'FriendActivityKind' })
  kind!: FriendActivityKind;

  @ApiProperty() userId!: string;

  @ApiProperty({ type: () => ParticipantSummaryDto })
  user!: ParticipantSummaryDto;

  @ApiPropertyOptional({ nullable: true, type: String })
  questId!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  questTitle!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  achievementId!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  achievementTitle!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  placeName!: string | null;

  @ApiPropertyOptional({ nullable: true, type: Number })
  xpEarned!: number | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}
