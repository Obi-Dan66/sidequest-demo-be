import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QuestDifficulty } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateQuestLocationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 240)
  address?: string;

  @ApiProperty()
  @IsLatitude()
  latitude!: number;

  @ApiProperty()
  @IsLongitude()
  longitude!: number;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(5000)
  radiusM?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;
}

export class CreateQuestDto {
  @ApiProperty()
  @IsString()
  @Length(3, 64)
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must be lowercase kebab-case' })
  slug!: string;

  @ApiProperty()
  @IsString()
  @Length(3, 120)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 240)
  summary?: string;

  @ApiProperty()
  @IsString()
  @Length(10, 5000)
  description!: string;

  @ApiPropertyOptional({ enum: QuestDifficulty, default: QuestDifficulty.EASY })
  @IsOptional()
  @IsEnum(QuestDifficulty)
  difficulty?: QuestDifficulty;

  @ApiPropertyOptional({ default: 50 })
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
  businessId?: string;

  @ApiProperty({ type: () => [CreateQuestLocationDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CreateQuestLocationDto)
  locations!: CreateQuestLocationDto[];
}
