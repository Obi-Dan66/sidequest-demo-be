import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Friendship, FriendshipStatus } from '@prisma/client';

export class FriendshipDto {
  @ApiProperty() id!: string;
  @ApiProperty() requesterId!: string;
  @ApiProperty() addresseeId!: string;
  @ApiProperty({ enum: FriendshipStatus }) status!: FriendshipStatus;
  @ApiPropertyOptional() respondedAt?: Date | null;
  @ApiProperty() createdAt!: Date;

  static fromEntity(f: Friendship): FriendshipDto {
    return {
      id: f.id,
      requesterId: f.requesterId,
      addresseeId: f.addresseeId,
      status: f.status,
      respondedAt: f.respondedAt,
      createdAt: f.createdAt,
    };
  }
}
