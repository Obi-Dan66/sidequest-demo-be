import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export enum LeaderboardScope {
  GLOBAL = 'GLOBAL',
  CITY = 'CITY',
}

export enum LeaderboardPeriod {
  ALL_TIME = 'ALL_TIME',
  MONTH = 'MONTH',
  WEEK = 'WEEK',
}

export class LeaderboardQueryDto {
  @ApiPropertyOptional({ enum: LeaderboardScope, default: LeaderboardScope.GLOBAL })
  @IsOptional()
  @IsEnum(LeaderboardScope)
  scope?: LeaderboardScope;

  @ApiPropertyOptional({
    description: 'Required when scope=CITY (lowercase slug, e.g. prague)',
  })
  @ValidateIf((o: LeaderboardQueryDto) => o.scope === LeaderboardScope.CITY)
  @IsString()
  @IsNotEmpty()
  city?: string;

  @ApiPropertyOptional({ enum: LeaderboardPeriod, default: LeaderboardPeriod.ALL_TIME })
  @IsOptional()
  @IsEnum(LeaderboardPeriod)
  period?: LeaderboardPeriod;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return 20;
    const n = Number(value);
    return Number.isFinite(n) ? n : 20;
  })
  @IsInt()
  @Min(1)
  @Max(100)
  limit!: number;
}
