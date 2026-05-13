import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QuestCompletionStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class QuestHistoryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: QuestCompletionStatus, default: QuestCompletionStatus.COMPLETED })
  @IsOptional()
  @IsEnum(QuestCompletionStatus)
  status?: QuestCompletionStatus;
}

export class QuestHistoryQuestSnapshotDto {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional() coverImageUrl!: string | null;
}

export class QuestHistoryItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() questId!: string;
  @ApiProperty({ type: () => QuestHistoryQuestSnapshotDto })
  quest!: QuestHistoryQuestSnapshotDto;
  @ApiProperty({ enum: QuestCompletionStatus }) status!: QuestCompletionStatus;
  @ApiProperty() startedAt!: Date;
  @ApiPropertyOptional() completedAt!: Date | null;
  @ApiProperty() xpEarned!: number;
  @ApiPropertyOptional() durationMinutes!: number | null;
}
