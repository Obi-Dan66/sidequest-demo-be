import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InviteStatus } from '@prisma/client';

export class CreateInviteDto {
  @ApiProperty({ example: 'friend@example.com' })
  email!: string;
}

export class InviteCreatedDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ description: 'Full URL to open the signup flow with this invite' })
  inviteLink!: string;
}

export class InviteListItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ enum: InviteStatus }) status!: InviteStatus;
  @ApiProperty() sentAt!: Date;
  @ApiPropertyOptional() acceptedAt?: Date | null;
  @ApiPropertyOptional() inviteeId?: string | null;
}

export class InviteTokenPreviewDto {
  @ApiProperty()
  valid!: boolean;

  @ApiProperty()
  expired!: boolean;

  @ApiPropertyOptional()
  inviterUsername?: string;

  @ApiPropertyOptional({ description: 'Email this invite was sent to (for form prefill)' })
  invitedEmail?: string;
}
