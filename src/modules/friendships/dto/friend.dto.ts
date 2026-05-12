import { ApiProperty } from '@nestjs/swagger';
import { FriendshipStatus } from '@prisma/client';
import { UserDto } from '../../users/dto/user.dto';

export class FriendDto {
  @ApiProperty() friendshipId!: string;
  @ApiProperty({ enum: FriendshipStatus }) status!: FriendshipStatus;
  @ApiProperty({ type: () => UserDto }) user!: UserDto;
  @ApiProperty() since!: Date;
  @ApiProperty({ description: 'Direction relative to viewer: outgoing | incoming | mutual' })
  direction!: 'outgoing' | 'incoming' | 'mutual';
}
