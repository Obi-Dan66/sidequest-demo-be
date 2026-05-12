import { ApiPropertyOptional } from '@nestjs/swagger';
import { QuestDifficulty, QuestStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class UpdateQuestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(3, 120)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 240)
  summary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(10, 5000)
  description?: string;

  @ApiPropertyOptional({ enum: QuestDifficulty })
  @IsOptional()
  @IsEnum(QuestDifficulty)
  difficulty?: QuestDifficulty;

  @ApiPropertyOptional({ enum: QuestStatus })
  @IsOptional()
  @IsEnum(QuestStatus)
  status?: QuestStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  xpReward?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  estimatedDurationMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endsAt?: string;
}
