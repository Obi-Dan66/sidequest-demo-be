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
import {
  AppEvents,
  FriendRequestAcceptedEvent,
  QuestCompletedEvent,
  QuestLocationCheckedInEvent,
} from '../events/events.types';
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

    this.events.on(AppEvents.QuestLocationCheckedIn, async (payload: unknown) => {
      if (!this.isQuestLocationCheckedIn(payload)) return;
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
    const allDefs = await this.achievements.listAll();
    const userRows = await this.achievements.listForUser(userId);

    const userMap = new Map(userRows.map((ua) => [ua.achievementId, ua]));

    return allDefs.map((def) => {
      const ua = userMap.get(def.id);
      const isUnlocked = ua?.unlockedAt != null;

      let progress: UserAchievementDto['progress'] = null;
      if (!isUnlocked && def.targetValue != null) {
        progress = { current: ua?.progress ?? 0, target: def.targetValue };
      }

      return {
        id: def.id,
        slug: def.slug,
        name: def.name,
        description: def.description,
        iconUrl: def.iconUrl,
        type: def.type,
        xpBonus: def.xpBonus,
        unlockedAt: ua?.unlockedAt ?? null,
        progress,
      };
    });
  }

  async evaluateForUser(userId: string): Promise<void> {
    const definitions = await this.achievements.listAll();
    for (const def of definitions) {
      const existing = await this.achievements.findUserAchievement(userId, def.id);
      if (existing?.unlockedAt) continue;

      const result = await this.evaluateWithProgress(def, userId);

      if (existing) {
        if (result.earned && !existing.unlockedAt) {
          await this.unlock(userId, def);
        } else if (result.progress !== existing.progress) {
          await this.prisma.userAchievement.update({
            where: { userId_achievementId: { userId, achievementId: def.id } },
            data: { progress: result.progress },
          });
        }
      } else {
        if (result.earned) {
          await this.unlock(userId, def);
        } else if (result.progress > 0) {
          await this.prisma.userAchievement.create({
            data: { userId, achievementId: def.id, progress: result.progress },
          });
        }
      }
    }
  }

  private async unlock(userId: string, achievement: Achievement): Promise<void> {
    const before = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { level: true },
    });
    const previousLevel = before?.level ?? 1;

    await this.prisma.runInTransaction(async (tx) => {
      await tx.userAchievement.upsert({
        where: { userId_achievementId: { userId, achievementId: achievement.id } },
        create: {
          userId,
          achievementId: achievement.id,
          unlockedAt: new Date(),
          progress: achievement.targetValue ?? 0,
        },
        update: {
          unlockedAt: new Date(),
          progress: achievement.targetValue ?? 0,
        },
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

    if (achievement.xpBonus > 0) {
      const after = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { level: true },
      });
      const newLevel = after?.level ?? previousLevel;
      if (newLevel > previousLevel) {
        this.events.emit(AppEvents.LevelUp, { userId, previousLevel, newLevel });
      }
    }

    this.logger.log(`User ${userId} unlocked achievement ${achievement.slug}`);
  }

  private async evaluateWithProgress(
    achievement: Achievement,
    userId: string,
  ): Promise<{ earned: boolean; progress: number }> {
    const criteria = this.parseCriteria(achievement.criteria);

    switch (achievement.type) {
      case AchievementType.QUEST_COUNT: {
        if (criteria.minQuests === undefined) return { earned: false, progress: 0 };
        const completed = await this.prisma.questCompletion.count({
          where: { userId, status: QuestCompletionStatus.COMPLETED },
        });
        return { earned: completed >= criteria.minQuests, progress: completed };
      }

      case AchievementType.XP_THRESHOLD: {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { xp: true },
        });
        if (!user) return { earned: false, progress: 0 };
        const current = criteria.minXp !== undefined ? user.xp : levelFromXp(user.xp);
        const earned =
          (criteria.minXp !== undefined && user.xp >= criteria.minXp) ||
          (criteria.minLevel !== undefined && levelFromXp(user.xp) >= criteria.minLevel);
        return { earned, progress: current };
      }

      case AchievementType.CATEGORY_EXPLORER: {
        if (!criteria.categorySlug || criteria.minQuests === undefined)
          return { earned: false, progress: 0 };
        const completed = await this.prisma.questCompletion.count({
          where: {
            userId,
            status: QuestCompletionStatus.COMPLETED,
            quest: { category: { slug: criteria.categorySlug } },
          },
        });
        return { earned: completed >= criteria.minQuests, progress: completed };
      }

      case AchievementType.LOCATION_VISITS: {
        if (criteria.minLocations === undefined) return { earned: false, progress: 0 };
        const rows = await this.prisma.questCompletion.findMany({
          where: { userId, status: QuestCompletionStatus.COMPLETED },
          select: { quest: { select: { locations: { select: { id: true } } } } },
        });
        const distinct = new Set<string>();
        for (const row of rows) {
          for (const loc of row.quest.locations) distinct.add(loc.id);
        }
        return { earned: distinct.size >= criteria.minLocations, progress: distinct.size };
      }

      case AchievementType.SOCIAL: {
        if (criteria.minFriends === undefined) return { earned: false, progress: 0 };
        const friends = await this.prisma.friendship.count({
          where: {
            status: FriendshipStatus.ACCEPTED,
            OR: [{ requesterId: userId }, { addresseeId: userId }],
          },
        });
        return { earned: friends >= criteria.minFriends, progress: friends };
      }

      case AchievementType.STREAK: {
        if (criteria.minStreakDays === undefined) return { earned: false, progress: 0 };
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { streakDays: true },
        });
        if (!user) return { earned: false, progress: 0 };
        return {
          earned: user.streakDays >= criteria.minStreakDays,
          progress: user.streakDays,
        };
      }

      case AchievementType.CUSTOM:
      default:
        return { earned: false, progress: 0 };
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
    if (typeof Reflect.get(value, 'userId') !== 'string') return false;
    if (typeof Reflect.get(value, 'questId') !== 'string') return false;
    if (typeof Reflect.get(value, 'xpAwarded') !== 'number') return false;
    const at = Reflect.get(value, 'completedAt');
    return at instanceof Date;
  }

  private isQuestLocationCheckedIn(value: unknown): value is QuestLocationCheckedInEvent {
    if (typeof value !== 'object' || value === null) return false;
    return (
      typeof Reflect.get(value, 'userId') === 'string' &&
      typeof Reflect.get(value, 'questId') === 'string' &&
      typeof Reflect.get(value, 'locationId') === 'string'
    );
  }

  private isFriendAccepted(value: unknown): value is FriendRequestAcceptedEvent {
    if (typeof value !== 'object' || value === null) return false;
    return (
      typeof Reflect.get(value, 'requesterId') === 'string' &&
      typeof Reflect.get(value, 'addresseeId') === 'string'
    );
  }
}
