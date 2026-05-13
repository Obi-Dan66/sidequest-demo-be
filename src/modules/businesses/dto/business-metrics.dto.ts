import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { BusinessMetricsPeriod } from './business-metrics-period.enum';

export class MetricWithDeltaPctDto {
  @ApiProperty()
  value!: number;

  @ApiProperty({ description: 'Percent change vs the previous equal-length window' })
  deltaPct!: number;
}

export class MetricWithDeltaAbsDto {
  @ApiProperty()
  value!: number;

  @ApiProperty({
    description: 'Absolute change vs the previous equal-length window (rating points)',
  })
  deltaAbs!: number;
}

export class BusinessMetricsDto {
  @ApiProperty({ enum: BusinessMetricsPeriod, enumName: 'BusinessMetricsPeriod' })
  period!: BusinessMetricsPeriod;

  @ApiProperty({ type: MetricWithDeltaPctDto })
  monthlyVisits!: MetricWithDeltaPctDto;

  @ApiProperty({ type: MetricWithDeltaPctDto })
  questCompletions!: MetricWithDeltaPctDto;

  @ApiProperty({ type: MetricWithDeltaAbsDto })
  avgRating!: MetricWithDeltaAbsDto;

  @ApiProperty({ type: MetricWithDeltaPctDto })
  repeatVisitors!: MetricWithDeltaPctDto;
}

export class BusinessMetricsQueryDto {
  @ApiProperty({
    enum: BusinessMetricsPeriod,
    enumName: 'BusinessMetricsPeriod',
    default: BusinessMetricsPeriod.THIRTY_D,
  })
  @IsOptional()
  @IsEnum(BusinessMetricsPeriod)
  period?: BusinessMetricsPeriod;
}
