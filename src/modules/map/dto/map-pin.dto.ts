import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QuestDifficulty } from '@prisma/client';

export class MapPinDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['QUEST', 'BUSINESS'] }) kind!: 'QUEST' | 'BUSINESS';
  @ApiProperty() latitude!: number;
  @ApiProperty() longitude!: number;
  @ApiProperty() title!: string;
  @ApiPropertyOptional() refId?: string;
  @ApiPropertyOptional({ enum: QuestDifficulty }) difficulty?: QuestDifficulty;
  @ApiPropertyOptional() categorySlug?: string;
  @ApiPropertyOptional() colorHex?: string;
  @ApiPropertyOptional() imageUrl?: string | null;
  @ApiPropertyOptional() distanceM?: number;
}
