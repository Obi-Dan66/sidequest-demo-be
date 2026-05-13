import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Achievement, AchievementType } from '@prisma/client';

export class AchievementDto {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty() description!: string;
  @ApiPropertyOptional() iconUrl?: string | null;
  @ApiProperty({ enum: AchievementType }) type!: AchievementType;
  @ApiProperty() xpBonus!: number;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;

  static fromEntity(a: Achievement): AchievementDto {
    return {
      id: a.id,
      slug: a.slug,
      name: a.name,
      description: a.description,
      iconUrl: a.iconUrl,
      type: a.type,
      xpBonus: a.xpBonus,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  }
}

export class AchievementProgressDto {
  @ApiProperty() current!: number;
  @ApiProperty() target!: number;
}

export class UserAchievementDto {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty() description!: string;
  @ApiPropertyOptional() iconUrl!: string | null;
  @ApiProperty({ enum: AchievementType }) type!: AchievementType;
  @ApiProperty() xpBonus!: number;
  @ApiPropertyOptional() unlockedAt!: Date | null;
  @ApiPropertyOptional({ type: () => AchievementProgressDto })
  progress!: AchievementProgressDto | null;
}
