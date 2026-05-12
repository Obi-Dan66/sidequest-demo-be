import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Notification } from '@prisma/client';

export class NotificationDto {
  @ApiProperty() id!: string;
  @ApiProperty() userId!: string;
  @ApiProperty() type!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional() body?: string | null;
  @ApiPropertyOptional() data?: unknown;
  @ApiPropertyOptional() readAt?: Date | null;
  @ApiProperty() createdAt!: Date;

  static fromEntity(n: Notification): NotificationDto {
    return {
      id: n.id,
      userId: n.userId,
      type: n.type,
      title: n.title,
      body: n.body,
      data: n.data,
      readAt: n.readAt,
      createdAt: n.createdAt,
    };
  }
}
