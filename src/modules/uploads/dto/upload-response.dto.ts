import { ApiProperty } from '@nestjs/swagger';

export class UploadResponseDto {
  @ApiProperty() filename!: string;
  @ApiProperty() url!: string;
  @ApiProperty() sizeBytes!: number;
  @ApiProperty() mimeType!: string;
}
