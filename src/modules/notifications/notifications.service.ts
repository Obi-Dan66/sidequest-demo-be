import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ParticipantSummaryDto } from '../../common/dto/participant-summary.dto';
import { PaginatedResult, paginate } from '../../common/responses/api-response';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsBus } from '../events/events.bus';
import {
  AchievementUnlockedEvent,
  AppEvents,
  BusinessQuestApprovedEvent,
  FriendRequestAcceptedEvent,
  FriendRequestSentEvent,
  LevelUpEvent,
  QuestCompletedEvent,
} from '../events/events.types';
import { NotificationDto, NotificationType } from './dto/notification.dto';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsRepository } from './notifications.repository';

/**
 * Notification delivery orchestrator.
 *
 * MVP transports:
 *   - DB-persisted record (always)
 *   - WebSocket push to connected user (via NotificationsGateway)
 *
 * Future transports (BullMQ-driven jobs):
 *   - email
 *   - push notifications (FCM/APNs)
 *   - SMS
 *
 * The interface stays the same: emit a typed event -> NotificationsService persists +
 * dispatches over the available transports.
 */
@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly repo: NotificationsRepository,
    private readonly gateway: NotificationsGateway,
    private readonly events: EventsBus,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    this.events.on(AppEvents.QuestCompleted, (payload) => this.onQuestCompleted(payload));
    this.events.on(AppEvents.AchievementUnlocked, (payload) => this.onAchievementUnlocked(payload));
    this.events.on(AppEvents.FriendRequestSent, (payload) => this.onFriendRequestSent(payload));
    this.events.on(AppEvents.FriendRequestAccepted, (payload) =>
      this.onFriendRequestAccepted(payload),
    );
    this.events.on(AppEvents.LevelUp, (payload) => this.onLevelUp(payload));
    this.events.on(AppEvents.BusinessQuestApproved, (payload) =>
      this.onBusinessQuestApproved(payload),
    );
  }

  async send(input: {
    userId: string;
    type: NotificationType;
    title: string;
    body?: string;
    data?: Prisma.JsonObject;
  }): Promise<NotificationDto> {
    const created = await this.repo.create({
      user: { connect: { id: input.userId } },
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data,
    });

    const dto = NotificationDto.fromEntity(created);
    this.gateway.pushToUser(input.userId, dto);
    return dto;
  }

  async listForUser(
    userId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<NotificationDto>> {
    const { items, total } = await this.repo.listForUser(userId, (page - 1) * limit, limit);
    return paginate(items.map(NotificationDto.fromEntity), page, limit, total);
  }

  async countUnread(userId: string): Promise<number> {
    return this.repo.countUnread(userId);
  }

  async markRead(id: string, userId: string): Promise<void> {
    await this.repo.markRead(id, userId);
  }

  async markAllRead(userId: string): Promise<void> {
    await this.repo.markAllRead(userId);
  }

  // -------- event listeners ----------------------------------------------------

  private async onQuestCompleted(payload: unknown): Promise<void> {
    if (!this.isQuestCompleted(payload)) return;
    const data: Prisma.JsonObject = {
      questId: payload.questId,
      xpAwarded: payload.xpAwarded,
    };
    await this.send({
      userId: payload.userId,
      type: NotificationType.QUEST_COMPLETED,
      title: 'Quest completed!',
      body: `You earned ${payload.xpAwarded} XP.`,
      data,
    }).catch((err: unknown) => this.logger.warn(`notification failed: ${String(err)}`));
  }

  private async onAchievementUnlocked(payload: unknown): Promise<void> {
    if (!this.isAchievementUnlocked(payload)) return;
    const data: Prisma.JsonObject = {
      achievementId: payload.achievementId,
      slug: payload.achievementSlug,
    };
    await this.send({
      userId: payload.userId,
      type: NotificationType.ACHIEVEMENT_UNLOCKED,
      title: 'Achievement unlocked',
      body: `New achievement: ${payload.achievementSlug}`,
      data,
    }).catch((err: unknown) => this.logger.warn(`notification failed: ${String(err)}`));
  }

  private async onFriendRequestSent(payload: unknown): Promise<void> {
    if (!this.isFriendRequestSent(payload)) return;
    const fromUser = await this.loadParticipantSummary(payload.requesterId);
    const data: Prisma.JsonObject = { friendshipId: payload.friendshipId };
    if (fromUser) {
      data.fromUser = this.participantToJson(fromUser);
    }
    await this.send({
      userId: payload.addresseeId,
      type: NotificationType.FRIEND_REQUEST_RECEIVED,
      title: 'New friend request',
      data,
    }).catch((err: unknown) => this.logger.warn(`notification failed: ${String(err)}`));
  }

  private async onFriendRequestAccepted(payload: unknown): Promise<void> {
    if (!this.isFriendRequestAccepted(payload)) return;
    const fromUser = await this.loadParticipantSummary(payload.addresseeId);
    const data: Prisma.JsonObject = { friendshipId: payload.friendshipId };
    if (fromUser) {
      data.fromUser = this.participantToJson(fromUser);
    }
    await this.send({
      userId: payload.requesterId,
      type: NotificationType.FRIEND_REQUEST_ACCEPTED,
      title: 'Friend request accepted',
      data,
    }).catch((err: unknown) => this.logger.warn(`notification failed: ${String(err)}`));
  }

  private async onLevelUp(payload: unknown): Promise<void> {
    if (!this.isLevelUp(payload)) return;
    const data: Prisma.JsonObject = {
      previousLevel: payload.previousLevel,
      newLevel: payload.newLevel,
    };
    await this.send({
      userId: payload.userId,
      type: NotificationType.LEVEL_UP,
      title: 'Level up!',
      body: `You reached level ${payload.newLevel}.`,
      data,
    }).catch((err: unknown) => this.logger.warn(`notification failed: ${String(err)}`));
  }

  private async onBusinessQuestApproved(payload: unknown): Promise<void> {
    if (!this.isBusinessQuestApproved(payload)) return;
    const data: Prisma.JsonObject = { questId: payload.questId };
    await this.send({
      userId: payload.userId,
      type: NotificationType.BUSINESS_QUEST_APPROVED,
      title: 'Quest approved',
      body: 'Your business quest is now published.',
      data,
    }).catch((err: unknown) => this.logger.warn(`notification failed: ${String(err)}`));
  }

  private participantToJson(p: ParticipantSummaryDto): Prisma.JsonObject {
    const o: Prisma.JsonObject = {
      id: p.id,
      username: p.username,
      level: p.level,
    };
    if (p.displayName !== undefined) o.displayName = p.displayName;
    if (p.avatarUrl !== undefined) o.avatarUrl = p.avatarUrl;
    return o;
  }

  private async loadParticipantSummary(userId: string): Promise<ParticipantSummaryDto | null> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, displayName: true, avatarUrl: true, level: true },
    });
    if (!u) return null;
    return {
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      level: u.level,
    };
  }

  // -------- type guards --------------------------------------------------------

  private isQuestCompleted(v: unknown): v is QuestCompletedEvent {
    if (typeof v !== 'object' || v === null) return false;
    return (
      typeof Reflect.get(v, 'userId') === 'string' &&
      typeof Reflect.get(v, 'questId') === 'string' &&
      typeof Reflect.get(v, 'xpAwarded') === 'number'
    );
  }

  private isAchievementUnlocked(v: unknown): v is AchievementUnlockedEvent {
    if (typeof v !== 'object' || v === null) return false;
    return (
      typeof Reflect.get(v, 'userId') === 'string' &&
      typeof Reflect.get(v, 'achievementId') === 'string' &&
      typeof Reflect.get(v, 'achievementSlug') === 'string'
    );
  }

  private isFriendRequestSent(v: unknown): v is FriendRequestSentEvent {
    if (typeof v !== 'object' || v === null) return false;
    return (
      typeof Reflect.get(v, 'requesterId') === 'string' &&
      typeof Reflect.get(v, 'addresseeId') === 'string' &&
      typeof Reflect.get(v, 'friendshipId') === 'string'
    );
  }

  private isFriendRequestAccepted(v: unknown): v is FriendRequestAcceptedEvent {
    return this.isFriendRequestSent(v);
  }

  private isLevelUp(v: unknown): v is LevelUpEvent {
    if (typeof v !== 'object' || v === null) return false;
    return (
      typeof Reflect.get(v, 'userId') === 'string' &&
      typeof Reflect.get(v, 'previousLevel') === 'number' &&
      typeof Reflect.get(v, 'newLevel') === 'number'
    );
  }

  private isBusinessQuestApproved(v: unknown): v is BusinessQuestApprovedEvent {
    if (typeof v !== 'object' || v === null) return false;
    return (
      typeof Reflect.get(v, 'userId') === 'string' && typeof Reflect.get(v, 'questId') === 'string'
    );
  }
}
