import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginatedResult, paginate } from '../../common/responses/api-response';
import { EventsBus } from '../events/events.bus';
import {
  AchievementUnlockedEvent,
  AppEvents,
  FriendRequestAcceptedEvent,
  FriendRequestSentEvent,
  QuestCompletedEvent,
} from '../events/events.types';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsRepository } from './notifications.repository';
import { NotificationDto } from './dto/notification.dto';

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
  ) {}

  onModuleInit(): void {
    this.events.on(AppEvents.QuestCompleted, (payload) => this.onQuestCompleted(payload));
    this.events.on(AppEvents.AchievementUnlocked, (payload) => this.onAchievementUnlocked(payload));
    this.events.on(AppEvents.FriendRequestSent, (payload) => this.onFriendRequestSent(payload));
    this.events.on(AppEvents.FriendRequestAccepted, (payload) =>
      this.onFriendRequestAccepted(payload),
    );
  }

  async send(input: {
    userId: string;
    type: string;
    title: string;
    body?: string;
    data?: Prisma.InputJsonValue;
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

  async markRead(id: string, userId: string): Promise<void> {
    await this.repo.markRead(id, userId);
  }

  async markAllRead(userId: string): Promise<void> {
    await this.repo.markAllRead(userId);
  }

  // -------- event listeners ----------------------------------------------------

  private async onQuestCompleted(payload: unknown): Promise<void> {
    if (!this.isQuestCompleted(payload)) return;
    await this.send({
      userId: payload.userId,
      type: 'quest.completed',
      title: 'Quest completed!',
      body: `You earned ${payload.xpAwarded} XP.`,
      data: { questId: payload.questId, xpAwarded: payload.xpAwarded },
    }).catch((err: unknown) => this.logger.warn(`notification failed: ${String(err)}`));
  }

  private async onAchievementUnlocked(payload: unknown): Promise<void> {
    if (!this.isAchievementUnlocked(payload)) return;
    await this.send({
      userId: payload.userId,
      type: 'achievement.unlocked',
      title: 'Achievement unlocked',
      body: `New achievement: ${payload.achievementSlug}`,
      data: { achievementId: payload.achievementId, slug: payload.achievementSlug },
    }).catch((err: unknown) => this.logger.warn(`notification failed: ${String(err)}`));
  }

  private async onFriendRequestSent(payload: unknown): Promise<void> {
    if (!this.isFriendRequestSent(payload)) return;
    await this.send({
      userId: payload.addresseeId,
      type: 'friend.request',
      title: 'New friend request',
      data: { requesterId: payload.requesterId },
    }).catch((err: unknown) => this.logger.warn(`notification failed: ${String(err)}`));
  }

  private async onFriendRequestAccepted(payload: unknown): Promise<void> {
    if (!this.isFriendRequestAccepted(payload)) return;
    await this.send({
      userId: payload.requesterId,
      type: 'friend.accepted',
      title: 'Friend request accepted',
      data: { addresseeId: payload.addresseeId },
    }).catch((err: unknown) => this.logger.warn(`notification failed: ${String(err)}`));
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
      typeof Reflect.get(v, 'addresseeId') === 'string'
    );
  }
  private isFriendRequestAccepted(v: unknown): v is FriendRequestAcceptedEvent {
    return this.isFriendRequestSent(v);
  }
}
