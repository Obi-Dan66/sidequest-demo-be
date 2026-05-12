import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Quest, QuestDifficulty, QuestStatus } from '@prisma/client';

export class QuestLocationDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional() name?: string | null;
  @ApiPropertyOptional() address?: string | null;
  @ApiProperty() latitude!: number;
  @ApiProperty() longitude!: number;
  @ApiProperty() radiusM!: number;
  @ApiProperty() orderIndex!: number;
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
  @ApiPropertyOptional() categoryId?: string | null;
  @ApiPropertyOptional() businessId?: string | null;
  @ApiPropertyOptional() authorId?: string | null;
  @ApiPropertyOptional() publishedAt?: Date | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  @ApiPropertyOptional({ type: () => [QuestLocationDto] })
  locations?: QuestLocationDto[];

  static fromEntity(quest: Quest, locations?: QuestLocationDto[]): QuestDto {
    return {
      id: quest.id,
      slug: quest.slug,
      title: quest.title,
      summary: quest.summary,
      description: quest.description,
      difficulty: quest.difficulty,
      status: quest.status,
      xpReward: quest.xpReward,
      estimatedDurationMin: quest.estimatedDurationMin,
      categoryId: quest.categoryId,
      businessId: quest.businessId,
      authorId: quest.authorId,
      publishedAt: quest.publishedAt,
      createdAt: quest.createdAt,
      updatedAt: quest.updatedAt,
      locations,
    };
  }
}
