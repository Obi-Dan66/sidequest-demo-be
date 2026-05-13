import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { BusinessMetricsPeriod } from './business-metrics-period.enum';

export class BusinessTopQuestDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() visits!: number;
  @ApiProperty() completions!: number;
  @ApiProperty({ description: 'completions / visits when visits > 0, else 0' })
  conversion!: number;
  @ApiProperty({ nullable: true, type: Number })
  rating!: number | null;
  @ApiProperty() ratingCount!: number;
}

export class BusinessTopQuestsQueryDto {
  @ApiProperty({
    enum: BusinessMetricsPeriod,
    enumName: 'BusinessMetricsPeriod',
    default: BusinessMetricsPeriod.THIRTY_D,
  })
  @IsOptional()
  @IsEnum(BusinessMetricsPeriod)
  period?: BusinessMetricsPeriod;

  @ApiProperty({ default: 10, minimum: 1, maximum: 50 })
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return 10;
    const n = Number(value);
    return Number.isFinite(n) ? n : 10;
  })
  @IsInt()
  @Min(1)
  @Max(50)
  limit!: number;
}
