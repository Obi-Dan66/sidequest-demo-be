import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QuestDifficulty, QuestStatus } from '@prisma/client';
import { ParticipantSummaryDto } from '../../../common/dto/participant-summary.dto';
import { QuestCategoryDto } from './quest-category.dto';

export class QuestLocationDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional() name?: string | null;
  @ApiPropertyOptional() address?: string | null;
  @ApiProperty() latitude!: number;
  @ApiProperty() longitude!: number;
  @ApiProperty() radiusM!: number;
  @ApiProperty() orderIndex!: number;
  @ApiPropertyOptional({ description: 'Distance in meters from the requested point' })
  distanceM?: number;
  @ApiPropertyOptional({ description: 'Set when the request carries a valid access token' })
  isCompleted?: boolean;
}

export class AchievementSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() iconUrl!: string | null;
  @ApiProperty() xpBonus!: number;
}

export class QuestRewardsDto {
  @ApiProperty() xp!: number;
  @ApiProperty({ type: () => [AchievementSummaryDto] })
  achievements!: AchievementSummaryDto[];
}

export class QuestDto {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional() summary?: string | null;
  @ApiProperty() description!: string;
  @ApiProperty({ enum: QuestDifficulty }) difficulty!: QuestDifficulty;
  @ApiProperty({ enum: QuestStatus }) status!: QuestStatus;
  @ApiProperty() xpReward!: number;
  @ApiPropertyOptional() estimatedDurationMin?: number | null;
  @ApiPropertyOptional() imageUrl?: string | null;
  @ApiPropertyOptional() coverImageUrl?: string | null;
  @ApiPropertyOptional() categoryId?: string | null;
  @ApiPropertyOptional() businessId?: string | null;
  @ApiPropertyOptional() authorId?: string | null;
  @ApiPropertyOptional() publishedAt?: Date | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  @ApiPropertyOptional({ type: () => [QuestLocationDto] })
  locations?: QuestLocationDto[];
  @ApiPropertyOptional({
    description: 'Distance in meters to the nearest location (nearby search)',
  })
  distanceM?: number;

  @ApiProperty({ type: () => [String] }) tags!: string[];
  @ApiPropertyOptional() rating!: number | null;
  @ApiProperty() ratingCount!: number;
  @ApiProperty() participantCount!: number;
  @ApiPropertyOptional({ type: () => [ParticipantSummaryDto] })
  participants!: ParticipantSummaryDto[];
  @ApiPropertyOptional({ type: () => QuestCategoryDto })
  category!: QuestCategoryDto | null;
  @ApiProperty({ type: () => QuestRewardsDto })
  rewards!: QuestRewardsDto;
}
