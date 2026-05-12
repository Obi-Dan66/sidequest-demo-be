import { ApiPropertyOptional } from '@nestjs/swagger';
import { QuestDifficulty } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Bounding-box query for map viewport requests.
 * Use `west < east` and `south < north`. Anti-meridian crossing is not supported in MVP.
 */
export class MapBoundsQueryDto {
  @ApiPropertyOptional({ minimum: -90, maximum: 90 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  south?: number;

  @ApiPropertyOptional({ minimum: -90, maximum: 90 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  north?: number;

  @ApiPropertyOptional({ minimum: -180, maximum: 180 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  west?: number;

  @ApiPropertyOptional({ minimum: -180, maximum: 180 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  east?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 1000, default: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;

  @ApiPropertyOptional({ description: 'Filter pins by quest category slug' })
  @IsOptional()
  @IsString()
  categorySlug?: string;

  @ApiPropertyOptional({ enum: QuestDifficulty })
  @IsOptional()
  @IsEnum(QuestDifficulty)
  difficulty?: QuestDifficulty;

  @ApiPropertyOptional({ description: 'Restrict pin kinds (comma-separated): QUEST, BUSINESS' })
  @IsOptional()
  @IsString()
  kinds?: string;
}
