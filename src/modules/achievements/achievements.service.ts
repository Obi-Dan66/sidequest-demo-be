import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Achievement, AchievementType } from '@prisma/client';
import { EventsBus } from '../events/events.bus';
import { AppEvents, QuestCompletedEvent } from '../events/events.types';
import { QuestCompletionsRepository } from '../quests/quest-completions.repository';
import { AchievementsRepository } from './achievements.repository';
import { AchievementDto, UserAchievementDto } from './dto/achievement.dto';

/**
 * Gamification engine.
 *
 * Achievements are *data-driven*: every Achievement row carries a `criteria` JSON blob.
 * On relevant domain events (quest completed, etc.) we re-evaluate criteria
 * for the affected user. New achievement types can be added by extending `evaluate()`.
 */
@Injectable()
export class AchievementsService implements OnModuleInit {
  private readonly logger = new Logger(AchievementsService.name);

  constructor(
    private readonly achievements: AchievementsRepository,
    private readonly completions: QuestCompletionsRepository,
    private readonly events: EventsBus,
  ) {}

  onModuleInit(): void {
    this.events.on(AppEvents.QuestCompleted, async (payload: unknown) => {
      if (!this.isQuestCompleted(payload)) return;
      await this.evaluateForUser(payload.userId);
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
    const all = await this.achievements.listAll();
    for (const achievement of all) {
      const existing = await this.achievements.findUserAchievement(userId, achievement.id);
      if (existing) continue;

      const earned = await this.evaluate(achievement, userId);
      if (earned) {
        await this.achievements.unlock(userId, achievement.id);
        this.events.emit(AppEvents.AchievementUnlocked, {
          userId,
          achievementId: achievement.id,
          achievementSlug: achievement.slug,
        });
        this.logger.log(`User ${userId} unlocked achievement ${achievement.slug}`);
      }
    }
  }

  /**
   * Achievement evaluator. Extend this with new branches per AchievementType.
   * Criteria shape is documented in SKILL.md.
   */
  private async evaluate(achievement: Achievement, userId: string): Promise<boolean> {
    switch (achievement.type) {
      case AchievementType.QUEST_COUNT: {
        const required = this.readNumber(achievement.criteria, 'minQuests');
        if (required === undefined) return false;
        const done = await this.completions.countCompletedForUser(userId);
        return done >= required;
      }
      // Placeholders - flesh out per gamification roadmap.
      case AchievementType.XP_THRESHOLD:
      case AchievementType.CATEGORY_EXPLORER:
      case AchievementType.LOCATION_VISITS:
      case AchievementType.SOCIAL:
      case AchievementType.STREAK:
      case AchievementType.CUSTOM:
      default:
        return false;
    }
  }

  private readNumber(criteria: unknown, key: string): number | undefined {
    if (typeof criteria !== 'object' || criteria === null) return undefined;
    const value = Reflect.get(criteria, key);
    return typeof value === 'number' ? value : undefined;
  }

  private isQuestCompleted(value: unknown): value is QuestCompletedEvent {
    if (typeof value !== 'object' || value === null) return false;
    const userId = Reflect.get(value, 'userId');
    return typeof userId === 'string';
  }
}
