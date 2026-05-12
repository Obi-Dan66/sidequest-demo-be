import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MapPinDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ['QUEST', 'BUSINESS'] }) kind!: 'QUEST' | 'BUSINESS';
  @ApiProperty() latitude!: number;
  @ApiProperty() longitude!: number;
  @ApiProperty() title!: string;
  @ApiPropertyOptional() refId?: string;
}
