import { ApiProperty } from '@nestjs/swagger';

export class NotificationUnreadCountDto {
  @ApiProperty({ description: 'Notifications with readAt unset' })
  count!: number;
}
