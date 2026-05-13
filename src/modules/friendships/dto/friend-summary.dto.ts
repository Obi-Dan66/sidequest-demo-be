import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum FriendPresenceStatus {
  ONLINE = 'ONLINE',
  QUESTING = 'QUESTING',
  OFFLINE = 'OFFLINE',
}

export class FriendCurrentQuestDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
}

export class FriendSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() username!: string;
  @ApiPropertyOptional() displayName!: string | null;
  @ApiPropertyOptional() avatarUrl!: string | null;
  @ApiProperty() level!: number;
  @ApiProperty() xp!: number;
  @ApiProperty({ enum: FriendPresenceStatus }) status!: FriendPresenceStatus;
  @ApiPropertyOptional({ type: () => FriendCurrentQuestDto })
  currentQuest!: FriendCurrentQuestDto | null;
  @ApiPropertyOptional({ description: 'Visible only between accepted friends' })
  lastSeenAt!: Date | null;
  @ApiProperty() mutualQuestsCount!: number;
}
