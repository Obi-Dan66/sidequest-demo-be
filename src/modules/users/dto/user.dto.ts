import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { User, UserRole, UserStatus } from '@prisma/client';

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
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;

  static fromEntity(user: User): UserDto {
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
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
