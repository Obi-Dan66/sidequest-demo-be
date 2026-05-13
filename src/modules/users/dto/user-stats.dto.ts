import { ApiProperty } from '@nestjs/swagger';

export class CompletionBreakdownDto {
  @ApiProperty() started!: number;
  @ApiProperty() completed!: number;
  @ApiProperty() abandoned!: number;
  @ApiProperty() expired!: number;
}

export class CategoryBreakdownItemDto {
  @ApiProperty() categorySlug!: string;
  @ApiProperty() categoryName!: string;
  @ApiProperty() completed!: number;
}

export class UserStatsDto {
  @ApiProperty() userId!: string;
  @ApiProperty() level!: number;
  @ApiProperty() currentXp!: number;
  @ApiProperty() xpForCurrentLevel!: number;
  @ApiProperty() xpForNextLevel!: number;
  @ApiProperty() xpIntoLevel!: number;
  @ApiProperty() xpToNextLevel!: number;
  @ApiProperty({ description: '0.0 - 1.0 progress towards next level' })
  progressRatio!: number;

  @ApiProperty() questsDone!: number;
  @ApiProperty() achievementsUnlocked!: number;
  @ApiProperty() friendsCount!: number;
  @ApiProperty() streakDays!: number;
  @ApiProperty() longestStreakDays!: number;
  @ApiProperty() placesVisited!: number;
  @ApiProperty({ description: 'Total distance walked in kilometers' })
  distanceWalkedKm!: number;

  @ApiProperty({ type: () => CompletionBreakdownDto })
  completions!: CompletionBreakdownDto;

  @ApiProperty({ type: () => [CategoryBreakdownItemDto] })
  byCategory!: CategoryBreakdownItemDto[];
}
