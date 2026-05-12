import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ActivityKind {
  QuestCompleted = 'QUEST_COMPLETED',
  AchievementUnlocked = 'ACHIEVEMENT_UNLOCKED',
}

export class ActivityActorDto {
  @ApiProperty() id!: string;
  @ApiProperty() username!: string;
  @ApiPropertyOptional() displayName?: string | null;
  @ApiPropertyOptional() avatarUrl?: string | null;
}

export class ActivityQuestRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional() imageUrl?: string | null;
  @ApiProperty() xpAwarded!: number;
}

export class ActivityAchievementRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() iconUrl?: string | null;
}

export class ActivityItemDto {
  @ApiProperty({ enum: ActivityKind }) kind!: ActivityKind;
  @ApiProperty() at!: Date;
  @ApiProperty({ type: () => ActivityActorDto }) actor!: ActivityActorDto;
  @ApiPropertyOptional({ type: () => ActivityQuestRefDto }) quest?: ActivityQuestRefDto;
  @ApiPropertyOptional({ type: () => ActivityAchievementRefDto })
  achievement?: ActivityAchievementRefDto;
}
