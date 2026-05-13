import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { User, UserRole, UserStatus } from '@prisma/client';
import { resolvePublicUserTitle } from '../../../common/gamification/user-title.util';

export interface UserDtoInviteOptions {
  inviteLink: string;
}

/**
 * Public-facing user representation. NEVER returns passwordHash or refreshTokenHash.
 */
export class UserDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() username!: string;
  @ApiPropertyOptional() displayName?: string | null;
  @ApiPropertyOptional() avatarUrl?: string | null;
  @ApiPropertyOptional() bio?: string | null;
  @ApiProperty({ enum: UserRole }) role!: UserRole;
  @ApiProperty({ enum: UserStatus }) status!: UserStatus;
  @ApiProperty() xp!: number;
  @ApiProperty() level!: number;
  @ApiProperty() questsDone!: number;
  @ApiProperty({
    nullable: true,
    description:
      'Gamified rank from level and quest count (capped by the lower tier), unless `titleOverride` is set',
  })
  title!: string | null;
  @ApiProperty() streakDays!: number;
  @ApiProperty({
    description:
      'Public registration URL using username ref (separate from single-use email invite tokens)',
  })
  inviteLink!: string;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;

  static fromEntity(user: User, options: UserDtoInviteOptions): UserDto {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      role: user.role,
      status: user.status,
      xp: user.xp,
      level: user.level,
      questsDone: user.questsDone,
      title: resolvePublicUserTitle(user),
      streakDays: user.streakDays,
      inviteLink: options.inviteLink,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
