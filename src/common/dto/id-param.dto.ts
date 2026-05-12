import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class IdParamDto {
  @ApiProperty({ description: 'CUID identifier' })
  @IsString()
  @Length(1, 64)
  id!: string;
}
