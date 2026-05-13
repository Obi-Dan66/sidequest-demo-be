import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Notification } from '@prisma/client';
import { ParticipantSummaryDto } from '../../../common/dto/participant-summary.dto';

export enum NotificationType {
  QUEST_COMPLETED = 'QUEST_COMPLETED',
  ACHIEVEMENT_UNLOCKED = 'ACHIEVEMENT_UNLOCKED',
  FRIEND_REQUEST_RECEIVED = 'FRIEND_REQUEST_RECEIVED',
  FRIEND_REQUEST_ACCEPTED = 'FRIEND_REQUEST_ACCEPTED',
  LEVEL_UP = 'LEVEL_UP',
  BUSINESS_QUEST_APPROVED = 'BUSINESS_QUEST_APPROVED',
}

/** Client deep-link payload; which fields are set depends on `NotificationDto.type`. */
export class NotificationDataDto {
  @ApiPropertyOptional() questId?: string;
  @ApiPropertyOptional() xpAwarded?: number;
  @ApiPropertyOptional() achievementId?: string;
  @ApiPropertyOptional() slug?: string;
  @ApiPropertyOptional() friendshipId?: string;
  @ApiPropertyOptional({ type: ParticipantSummaryDto })
  fromUser?: ParticipantSummaryDto;
  @ApiPropertyOptional() previousLevel?: number;
  @ApiPropertyOptional() newLevel?: number;
}

function parseStoredNotificationType(stored: string): NotificationType {
  switch (stored) {
    case NotificationType.QUEST_COMPLETED:
    case 'quest.completed':
      return NotificationType.QUEST_COMPLETED;
    case NotificationType.ACHIEVEMENT_UNLOCKED:
    case 'achievement.unlocked':
      return NotificationType.ACHIEVEMENT_UNLOCKED;
    case NotificationType.FRIEND_REQUEST_RECEIVED:
    case 'friend.request':
      return NotificationType.FRIEND_REQUEST_RECEIVED;
    case NotificationType.FRIEND_REQUEST_ACCEPTED:
    case 'friend.accepted':
      return NotificationType.FRIEND_REQUEST_ACCEPTED;
    case NotificationType.LEVEL_UP:
      return NotificationType.LEVEL_UP;
    case NotificationType.BUSINESS_QUEST_APPROVED:
      return NotificationType.BUSINESS_QUEST_APPROVED;
    default:
      return NotificationType.QUEST_COMPLETED;
  }
}

function parseNotificationDataJson(value: unknown): NotificationDataDto | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const out: NotificationDataDto = {};

  const questId = Reflect.get(value, 'questId');
  if (typeof questId === 'string') out.questId = questId;

  const xpAwarded = Reflect.get(value, 'xpAwarded');
  if (typeof xpAwarded === 'number') out.xpAwarded = xpAwarded;

  const achievementId = Reflect.get(value, 'achievementId');
  if (typeof achievementId === 'string') out.achievementId = achievementId;

  const slug = Reflect.get(value, 'slug');
  if (typeof slug === 'string') out.slug = slug;

  const friendshipId = Reflect.get(value, 'friendshipId');
  if (typeof friendshipId === 'string') out.friendshipId = friendshipId;

  const previousLevel = Reflect.get(value, 'previousLevel');
  if (typeof previousLevel === 'number') out.previousLevel = previousLevel;

  const newLevel = Reflect.get(value, 'newLevel');
  if (typeof newLevel === 'number') out.newLevel = newLevel;

  const fromUserVal = Reflect.get(value, 'fromUser');
  if (typeof fromUserVal === 'object' && fromUserVal !== null) {
    const id = Reflect.get(fromUserVal, 'id');
    const username = Reflect.get(fromUserVal, 'username');
    const level = Reflect.get(fromUserVal, 'level');
    if (typeof id === 'string' && typeof username === 'string' && typeof level === 'number') {
      const dnRaw = Reflect.get(fromUserVal, 'displayName');
      let displayName: string | null = null;
      if (typeof dnRaw === 'string') displayName = dnRaw;
      else if (dnRaw === null) displayName = null;

      const avRaw = Reflect.get(fromUserVal, 'avatarUrl');
      let avatarUrl: string | null = null;
      if (typeof avRaw === 'string') avatarUrl = avRaw;
      else if (avRaw === null) avatarUrl = null;

      const fromUser: ParticipantSummaryDto = { id, username, level, displayName, avatarUrl };
      out.fromUser = fromUser;
    }
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

export class NotificationDto {
  @ApiProperty() id!: string;
  @ApiProperty() userId!: string;
  @ApiProperty({ enum: NotificationType, enumName: 'NotificationType' })
  type!: NotificationType;
  @ApiProperty() title!: string;
  @ApiPropertyOptional() body?: string | null;
  @ApiPropertyOptional({ type: NotificationDataDto })
  data?: NotificationDataDto;
  @ApiPropertyOptional() readAt?: Date | null;
  @ApiProperty() createdAt!: Date;

  static fromEntity(n: Notification): NotificationDto {
    return {
      id: n.id,
      userId: n.userId,
      type: parseStoredNotificationType(n.type),
      title: n.title,
      body: n.body,
      data: parseNotificationDataJson(n.data),
      readAt: n.readAt,
      createdAt: n.createdAt,
    };
  }
}
