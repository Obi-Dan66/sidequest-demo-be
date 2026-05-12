import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateFriendshipDto {
  @ApiProperty({ description: 'User id of the addressee' })
  @IsString()
  addresseeId!: string;
}
