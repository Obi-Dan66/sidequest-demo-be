import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  Achievement,
  AchievementType,
  FriendshipStatus,
  QuestCompletionStatus,
} from '@prisma/client';
import { levelFromXp } from '../../common/gamification/xp';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsBus } from '../events/events.bus';
import { AppEvents, FriendRequestAcceptedEvent, QuestCompletedEvent } from '../events/events.types';
import { AchievementDto, UserAchievementDto } from './dto/achievement.dto';
import { AchievementsRepository } from './achievements.repository';

interface AchievementCriteria {
  minQuests?: number;
  minXp?: number;
  minLevel?: number;
  minLocations?: number;
  minFriends?: number;
  minStreakDays?: number;
  categorySlug?: string;
}

/**
 * Gamification engine.
 *
 * Data-driven: every Achievement row carries a `criteria` JSON blob whose shape
 * is documented in `AchievementCriteria`. On every relevant domain event we
 * re-evaluate all not-yet-unlocked achievements for the affected user.
 *
 * Side effect on unlock:
 *   - insert UserAchievement
 *   - increment user.xp by `Achievement.xpBonus` (and re-derive level)
 *   - emit `AchievementUnlocked` for the notifications fan-out
 */
@Injectable()
export class AchievementsService implements OnModuleInit {
  private readonly logger = new Logger(AchievementsService.name);

  constructor(
    private readonly achievements: AchievementsRepository,
    private readonly events: EventsBus,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    this.events.on(AppEvents.QuestCompleted, async (payload: unknown) => {
      if (!this.isQuestCompleted(payload)) return;
      await this.evaluateForUser(payload.userId);
    });

    this.events.on(AppEvents.FriendRequestAccepted, async (payload: unknown) => {
      if (!this.isFriendAccepted(payload)) return;
      await this.evaluateForUser(payload.requesterId);
      await this.evaluateForUser(payload.addresseeId);
    });
  }

  async listAll(): Promise<AchievementDto[]> {
    const all = await this.achievements.listAll();
    return all.map(AchievementDto.fromEntity);
  }

  async listForUser(userId: string): Promise<UserAchievementDto[]> {
    const unlocked = await this.achievements.listForUser(userId);
    return unlocked.map(UserAchievementDto.fromEntity);
  }

  async evaluateForUser(userId: string): Promise<void> {
    const definitions = await this.achievements.listAll();
    for (const def of definitions) {
      const existing = await this.achievements.findUserAchievement(userId, def.id);
      if (existing) continue;

      const earned = await this.evaluate(def, userId);
      if (!earned) continue;

      await this.unlock(userId, def);
    }
  }

  private async unlock(userId: string, achievement: Achievement): Promise<void> {
    await this.prisma.runInTransaction(async (tx) => {
      const existing = await tx.userAchievement.findUnique({
        where: { userId_achievementId: { userId, achievementId: achievement.id } },
      });
      if (existing) return;

      await tx.userAchievement.create({
        data: { userId, achievementId: achievement.id },
      });

      if (achievement.xpBonus > 0) {
        const user = await tx.user.update({
          where: { id: userId },
          data: { xp: { increment: achievement.xpBonus } },
          select: { xp: true },
        });
        await tx.user.update({
          where: { id: userId },
          data: { level: levelFromXp(user.xp) },
        });
      }
    });

    this.events.emit(AppEvents.AchievementUnlocked, {
      userId,
      achievementId: achievement.id,
      achievementSlug: achievement.slug,
    });
    this.logger.log(`User ${userId} unlocked achievement ${achievement.slug}`);
  }

  private async evaluate(achievement: Achievement, userId: string): Promise<boolean> {
    const criteria = this.parseCriteria(achievement.criteria);

    switch (achievement.type) {
      case AchievementType.QUEST_COUNT: {
        if (criteria.minQuests === undefined) return false;
        const completed = await this.prisma.questCompletion.count({
          where: { userId, status: QuestCompletionStatus.COMPLETED },
        });
        return completed >= criteria.minQuests;
      }

      case AchievementType.XP_THRESHOLD: {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { xp: true },
        });
        if (!user) return false;
        if (criteria.minXp !== undefined && user.xp < criteria.minXp) return false;
        if (criteria.minLevel !== undefined && levelFromXp(user.xp) < criteria.minLevel) {
          return false;
        }
        return criteria.minXp !== undefined || criteria.minLevel !== undefined;
      }

      case AchievementType.CATEGORY_EXPLORER: {
        if (!criteria.categorySlug || criteria.minQuests === undefined) return false;
        const completed = await this.prisma.questCompletion.count({
          where: {
            userId,
            status: QuestCompletionStatus.COMPLETED,
            quest: { category: { slug: criteria.categorySlug } },
          },
        });
        return completed >= criteria.minQuests;
      }

      case AchievementType.LOCATION_VISITS: {
        if (criteria.minLocations === undefined) return false;
        const rows = await this.prisma.questCompletion.findMany({
          where: { userId, status: QuestCompletionStatus.COMPLETED },
          select: { quest: { select: { locations: { select: { id: true } } } } },
        });
        const distinct = new Set<string>();
        for (const row of rows) {
          for (const loc of row.quest.locations) distinct.add(loc.id);
        }
        return distinct.size >= criteria.minLocations;
      }

      case AchievementType.SOCIAL: {
        if (criteria.minFriends === undefined) return false;
        const friends = await this.prisma.friendship.count({
          where: {
            status: FriendshipStatus.ACCEPTED,
            OR: [{ requesterId: userId }, { addresseeId: userId }],
          },
        });
        return friends >= criteria.minFriends;
      }

      case AchievementType.STREAK: {
        if (criteria.minStreakDays === undefined) return false;
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { streakDays: true },
        });
        if (!user) return false;
        return user.streakDays >= criteria.minStreakDays;
      }

      case AchievementType.CUSTOM:
      default:
        return false;
    }
  }

  private parseCriteria(value: unknown): AchievementCriteria {
    if (typeof value !== 'object' || value === null) return {};
    const out: AchievementCriteria = {};

    const minQuests = Reflect.get(value, 'minQuests');
    const minXp = Reflect.get(value, 'minXp');
    const minLevel = Reflect.get(value, 'minLevel');
    const minLocations = Reflect.get(value, 'minLocations');
    const minFriends = Reflect.get(value, 'minFriends');
    const minStreakDays = Reflect.get(value, 'minStreakDays');
    const categorySlug = Reflect.get(value, 'categorySlug');

    if (typeof minQuests === 'number') out.minQuests = minQuests;
    if (typeof minXp === 'number') out.minXp = minXp;
    if (typeof minLevel === 'number') out.minLevel = minLevel;
    if (typeof minLocations === 'number') out.minLocations = minLocations;
    if (typeof minFriends === 'number') out.minFriends = minFriends;
    if (typeof minStreakDays === 'number') out.minStreakDays = minStreakDays;
    if (typeof categorySlug === 'string') out.categorySlug = categorySlug;
    return out;
  }

  private isQuestCompleted(value: unknown): value is QuestCompletedEvent {
    if (typeof value !== 'object' || value === null) return false;
    return typeof Reflect.get(value, 'userId') === 'string';
  }

  private isFriendAccepted(value: unknown): value is FriendRequestAcceptedEvent {
    if (typeof value !== 'object' || value === null) return false;
    return (
      typeof Reflect.get(value, 'requesterId') === 'string' &&
      typeof Reflect.get(value, 'addresseeId') === 'string'
    );
  }
}
