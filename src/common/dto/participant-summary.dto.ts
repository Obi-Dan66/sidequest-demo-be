import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ParticipantSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() username!: string;
  @ApiPropertyOptional() displayName!: string | null;
  @ApiPropertyOptional() avatarUrl!: string | null;
  @ApiProperty() level!: number;
}
