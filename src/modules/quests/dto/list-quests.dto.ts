import { ApiPropertyOptional } from '@nestjs/swagger';
import { QuestDifficulty, QuestStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { GeoQueryDto } from '../../../common/dto/geo-query.dto';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ListQuestsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: QuestStatus })
  @IsOptional()
  @IsEnum(QuestStatus)
  status?: QuestStatus;

  @ApiPropertyOptional({ enum: QuestDifficulty })
  @IsOptional()
  @IsEnum(QuestDifficulty)
  difficulty?: QuestDifficulty;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categorySlug?: string;
}

export class ListQuestsNearbyDto extends GeoQueryDto {
  @ApiPropertyOptional({ enum: QuestDifficulty })
  @IsOptional()
  @IsEnum(QuestDifficulty)
  difficulty?: QuestDifficulty;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categorySlug?: string;
}
