import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QuestCategory } from '@prisma/client';

export class QuestCategoryDto {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() description?: string | null;
  @ApiPropertyOptional() iconUrl?: string | null;
  @ApiPropertyOptional() coverImageUrl?: string | null;
  @ApiPropertyOptional() colorHex?: string | null;

  static fromEntity(c: QuestCategory): QuestCategoryDto {
    return {
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      iconUrl: c.iconUrl,
      coverImageUrl: c.coverImageUrl,
      colorHex: c.colorHex,
    };
  }
}
