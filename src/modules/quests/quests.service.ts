import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, QuestCompletionStatus, QuestLocation, QuestStatus } from '@prisma/client';
import { AppRole } from '../../common/auth/roles.enum';
import { levelFromXp } from '../../common/gamification/xp';
import { PaginatedResult, paginate } from '../../common/responses/api-response';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsBus } from '../events/events.bus';
import { AppEvents } from '../events/events.types';
import { GeoService } from '../geo/geo.service';
import { CreateQuestDto } from './dto/create-quest.dto';
import { ListQuestsDto, ListQuestsNearbyDto } from './dto/list-quests.dto';
import { QuestCheckInBodyDto } from './dto/quest-check-in.dto';
import { QuestDto, QuestLocationDto } from './dto/quest.dto';
import { QuestCategoryDto } from './dto/quest-category.dto';
import { RateQuestDto } from './dto/rate-quest.dto';
import { UpdateQuestDto } from './dto/update-quest.dto';
import { QuestCompletionsRepository } from './quest-completions.repository';
import { QuestWithEnrichment, QuestsRepository } from './quests.repository';

const STREAK_WINDOW_HOURS = 36;
const STREAK_RESET_HOURS = 48;

@Injectable()
export class QuestsService {
  constructor(
    private readonly quests: QuestsRepository,
    private readonly completions: QuestCompletionsRepository,
    private readonly geo: GeoService,
    private readonly events: EventsBus,
    private readonly prisma: PrismaService,
  ) {}

  async list(query: ListQuestsDto): Promise<PaginatedResult<QuestDto>> {
    const where: Prisma.QuestWhereInput = {
      status: query.status ?? QuestStatus.PUBLISHED,
      difficulty: query.difficulty,
      category: query.categorySlug ? { slug: query.categorySlug } : undefined,
      title: query.search ? { contains: query.search, mode: 'insensitive' } : undefined,
    };

    const { items, total } = await this.quests.list({
      skip: query.skip,
      take: query.take,
      where,
    });

    return paginate(
      items.map((q) => this.toDto(q)),
      query.page,
      query.limit,
      total,
    );
  }

  async listNearby(query: ListQuestsNearbyDto): Promise<QuestDto[]> {
    if (query.lat === undefined || query.lng === undefined) {
      throw new BadRequestException('lat and lng are required');
    }
    const radius = query.radiusM ?? 5000;
    const center = { latitude: query.lat, longitude: query.lng };
    const bbox = this.geo.boundingBox(center, radius);

    const where: Prisma.QuestWhereInput = {
      status: QuestStatus.PUBLISHED,
      difficulty: query.difficulty,
      category: query.categorySlug ? { slug: query.categorySlug } : undefined,
    };

    const candidates = await this.quests.findWithinBoundingBox({
      ...bbox,
      where,
      limit: 200,
    });

    const refined: Array<{ quest: QuestWithEnrichment; distance: number }> = [];
    for (const quest of candidates) {
      let nearest = Infinity;
      for (const loc of quest.locations) {
        const d = this.geo.haversineMeters(center, {
          latitude: loc.latitude,
          longitude: loc.longitude,
        });
        if (d < nearest) nearest = d;
      }
      if (nearest <= radius) {
        refined.push({ quest, distance: nearest });
      }
    }

    refined.sort((a, b) => a.distance - b.distance);

    return refined.map(({ quest, distance }) => {
      const dto = this.toDto(quest, center);
      dto.distanceM = Math.round(distance);
      return dto;
    });
  }

  async getById(id: string, viewerUserId?: string): Promise<QuestDto> {
    const quest = await this.quests.findById(id);
    if (!quest) throw new NotFoundException('Quest not found');
    const checked = viewerUserId ? await this.loadCheckedLocationIds(viewerUserId, id) : undefined;
    return this.toDto(quest, undefined, checked);
  }

  async getBySlug(slug: string, viewerUserId?: string): Promise<QuestDto> {
    const quest = await this.quests.findBySlug(slug);
    if (!quest) throw new NotFoundException('Quest not found');
    const checked = viewerUserId
      ? await this.loadCheckedLocationIds(viewerUserId, quest.id)
      : undefined;
    return this.toDto(quest, undefined, checked);
  }

  async create(authorId: string, dto: CreateQuestDto): Promise<QuestDto> {
    const existing = await this.quests.findBySlug(dto.slug);
    if (existing) throw new ConflictException('Quest slug already exists');

    const created = await this.quests.create({
      slug: dto.slug,
      title: dto.title,
      summary: dto.summary,
      description: dto.description,
      difficulty: dto.difficulty,
      xpReward: dto.xpReward ?? 50,
      estimatedDurationMin: dto.estimatedDurationMin,
      imageUrl: dto.imageUrl,
      coverImageUrl: dto.coverImageUrl,
      author: { connect: { id: authorId } },
      category: dto.categoryId ? { connect: { id: dto.categoryId } } : undefined,
      business: dto.businessId ? { connect: { id: dto.businessId } } : undefined,
      locations: {
        create: dto.locations.map((loc, idx) => ({
          name: loc.name,
          address: loc.address,
          latitude: loc.latitude,
          longitude: loc.longitude,
          radiusM: loc.radiusM ?? 50,
          orderIndex: loc.orderIndex ?? idx,
        })),
      },
    });

    return this.toDto(created);
  }

  async update(
    actor: { id: string; role: AppRole },
    questId: string,
    dto: UpdateQuestDto,
  ): Promise<QuestDto> {
    const quest = await this.quests.findById(questId);
    if (!quest) throw new NotFoundException('Quest not found');
    this.assertCanMutate(actor, quest.authorId);

    const data: Prisma.QuestUpdateInput = {
      title: dto.title,
      summary: dto.summary,
      description: dto.description,
      difficulty: dto.difficulty,
      status: dto.status,
      xpReward: dto.xpReward,
      estimatedDurationMin: dto.estimatedDurationMin,
      imageUrl: dto.imageUrl,
      coverImageUrl: dto.coverImageUrl,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
      category: dto.categoryId ? { connect: { id: dto.categoryId } } : undefined,
    };
    if (dto.status === QuestStatus.PUBLISHED && !quest.publishedAt) {
      data.publishedAt = new Date();
    }

    const updated = await this.quests.update(questId, data);
    return this.toDto(updated);
  }

  async delete(actor: { id: string; role: AppRole }, questId: string): Promise<void> {
    const quest = await this.quests.findById(questId);
    if (!quest) throw new NotFoundException('Quest not found');
    this.assertCanMutate(actor, quest.authorId);
    await this.quests.delete(questId);
  }

  async start(userId: string, questId: string): Promise<void> {
    const quest = await this.quests.findById(questId);
    if (!quest) throw new NotFoundException('Quest not found');
    if (quest.status !== QuestStatus.PUBLISHED) {
      throw new BadRequestException('Quest is not available');
    }
    await this.completions.start(userId, questId);
    this.events.emit(AppEvents.QuestStarted, { userId, questId });
  }

  async complete(
    userId: string,
    questId: string,
    proof?: Prisma.InputJsonValue,
  ): Promise<{ xpAwarded: number; leveledUp: boolean; newLevel: number; streakDays: number }> {
    const quest = await this.quests.findById(questId);
    if (!quest) throw new NotFoundException('Quest not found');

    const active = await this.completions.findActive(userId, questId);
    if (!active || active.status === 'COMPLETED') {
      throw new BadRequestException('Quest must be started before it can be completed');
    }

    const result = await this.prisma.runInTransaction(async (tx) =>
      this.finalizeQuestCompletionTx(tx, { userId, questId, quest, proof }),
    );

    this.events.emit(AppEvents.QuestCompleted, {
      userId,
      questId,
      xpAwarded: result.xpAwarded,
      completedAt: result.completedAt,
    });

    if (result.newLevel > result.previousLevel) {
      this.events.emit(AppEvents.LevelUp, {
        userId,
        previousLevel: result.previousLevel,
        newLevel: result.newLevel,
      });
    }

    return {
      xpAwarded: result.xpAwarded,
      leveledUp: result.newLevel > result.previousLevel,
      newLevel: result.newLevel,
      streakDays: result.streakDays,
    };
  }

  async checkInLocation(
    userId: string,
    questId: string,
    locationId: string,
    body: QuestCheckInBodyDto,
  ): Promise<{ httpStatus: number; stepCompleted: boolean; questCompleted: boolean }> {
    const quest = await this.quests.findById(questId);
    if (!quest) throw new NotFoundException('Quest not found');
    if (quest.status !== QuestStatus.PUBLISHED) {
      throw new BadRequestException('Quest is not available');
    }

    const location = await this.prisma.questLocation.findFirst({
      where: { id: locationId, questId },
    });
    if (!location) throw new NotFoundException('Location not found for this quest');

    const distanceM = this.geo.haversineMeters(
      { latitude: body.latitude, longitude: body.longitude },
      { latitude: location.latitude, longitude: location.longitude },
    );
    if (distanceM > location.radiusM) {
      throw new ConflictException({
        message: 'You are outside the allowed radius for this waypoint',
        code: 'OUT_OF_RANGE',
        details: { distanceM: Math.round(distanceM) },
      });
    }

    const existingCheckIn = await this.prisma.questLocationCheckIn.findUnique({
      where: { userId_locationId: { userId, locationId } },
    });
    if (existingCheckIn) {
      const row = await this.prisma.questCompletion.findUnique({
        where: { userId_questId: { userId, questId } },
        select: { status: true },
      });
      return {
        httpStatus: 200,
        stepCompleted: true,
        questCompleted: row?.status === QuestCompletionStatus.COMPLETED,
      };
    }

    const active = await this.completions.findActive(userId, questId);
    if (!active || active.status !== QuestCompletionStatus.STARTED) {
      throw new BadRequestException('Start the quest before checking in at waypoints');
    }

    const totalStops = quest.locations.length;
    if (totalStops === 0) {
      throw new BadRequestException('This quest has no waypoints');
    }

    const outcome = await this.prisma.runInTransaction(async (tx) => {
      const dup = await tx.questLocationCheckIn.findUnique({
        where: { userId_locationId: { userId, locationId } },
      });
      if (dup) {
        const c = await tx.questCompletion.findUnique({
          where: { userId_questId: { userId, questId } },
          select: { status: true },
        });
        return {
          httpStatus: 200,
          stepCompleted: true,
          questCompleted: c?.status === QuestCompletionStatus.COMPLETED,
          emitComplete: false,
          completedAt: undefined,
          xpAwarded: 0,
          previousLevel: 0,
          newLevel: 0,
        };
      }

      await tx.questLocationCheckIn.create({
        data: {
          userId,
          questId,
          locationId,
          latitude: body.latitude,
          longitude: body.longitude,
          accuracyM: body.accuracyM,
        },
      });

      await tx.questCompletion.update({
        where: { userId_questId: { userId, questId } },
        data: { checkedInLocationIds: { push: locationId } },
      });

      await tx.user.update({
        where: { id: userId },
        data: { placesVisited: { increment: 1 } },
      });

      const checkedCount = await tx.questLocationCheckIn.count({
        where: { userId, questId },
      });

      let questCompleted = false;
      let emitComplete = false;
      let completedAt: Date | undefined;
      let xpAwarded = 0;
      let previousLevel = 0;
      let newLevel = 0;

      if (checkedCount >= totalStops) {
        const fin = await this.finalizeQuestCompletionTx(tx, {
          userId,
          questId,
          quest,
          proof: { checkIns: true },
        });
        questCompleted = true;
        emitComplete = true;
        completedAt = fin.completedAt;
        xpAwarded = fin.xpAwarded;
        previousLevel = fin.previousLevel;
        newLevel = fin.newLevel;
      }

      return {
        httpStatus: 201,
        stepCompleted: true,
        questCompleted,
        emitComplete,
        completedAt,
        xpAwarded,
        previousLevel,
        newLevel,
      };
    });

    if (outcome.emitComplete && outcome.completedAt) {
      this.events.emit(AppEvents.QuestCompleted, {
        userId,
        questId,
        xpAwarded: outcome.xpAwarded,
        completedAt: outcome.completedAt,
      });
      if (outcome.newLevel > outcome.previousLevel) {
        this.events.emit(AppEvents.LevelUp, {
          userId,
          previousLevel: outcome.previousLevel,
          newLevel: outcome.newLevel,
        });
      }
    }

    if (outcome.httpStatus === 201) {
      this.events.emit(AppEvents.QuestLocationCheckedIn, { userId, questId, locationId });
    }

    return {
      httpStatus: outcome.httpStatus,
      stepCompleted: outcome.stepCompleted,
      questCompleted: outcome.questCompleted,
    };
  }

  async rate(userId: string, questId: string, dto: RateQuestDto): Promise<void> {
    const quest = await this.quests.findById(questId);
    if (!quest) throw new NotFoundException('Quest not found');

    await this.prisma.runInTransaction(async (tx) => {
      await tx.questRating.upsert({
        where: { userId_questId: { userId, questId } },
        create: { userId, questId, score: dto.score, comment: dto.comment },
        update: { score: dto.score, comment: dto.comment },
      });

      const agg = await tx.questRating.aggregate({
        where: { questId },
        _avg: { score: true },
        _count: { score: true },
      });

      await tx.quest.update({
        where: { id: questId },
        data: { ratingAvg: agg._avg.score, ratingCount: agg._count.score },
      });
    });
  }

  async unrate(userId: string, questId: string): Promise<void> {
    const quest = await this.quests.findById(questId);
    if (!quest) throw new NotFoundException('Quest not found');

    await this.prisma.runInTransaction(async (tx) => {
      await tx.questRating.deleteMany({ where: { userId, questId } });

      const agg = await tx.questRating.aggregate({
        where: { questId },
        _avg: { score: true },
        _count: { score: true },
      });

      await tx.quest.update({
        where: { id: questId },
        data: {
          ratingAvg: agg._count.score > 0 ? agg._avg.score : null,
          ratingCount: agg._count.score,
        },
      });
    });
  }

  private async loadCheckedLocationIds(userId: string, questId: string): Promise<Set<string>> {
    const rows = await this.prisma.questLocationCheckIn.findMany({
      where: { userId, questId },
      select: { locationId: true },
    });
    return new Set(rows.map((r) => r.locationId));
  }

  private sumPathDistanceMeters(locations: QuestLocation[]): number {
    const sorted = [...locations].sort((a, b) => a.orderIndex - b.orderIndex);
    let sum = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
      sum += this.geo.haversineMeters(
        { latitude: sorted[i].latitude, longitude: sorted[i].longitude },
        { latitude: sorted[i + 1].latitude, longitude: sorted[i + 1].longitude },
      );
    }
    return sum;
  }

  private async finalizeQuestCompletionTx(
    tx: Prisma.TransactionClient,
    params: {
      userId: string;
      questId: string;
      quest: QuestWithEnrichment;
      proof?: Prisma.InputJsonValue;
    },
  ): Promise<{
    xpAwarded: number;
    previousLevel: number;
    newLevel: number;
    streakDays: number;
    completedAt: Date;
  }> {
    const { userId, questId, quest, proof } = params;

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { xp: true, streakDays: true, longestStreakDays: true, lastQuestCompletedAt: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const now = new Date();
    const newStreak = this.computeStreak(user.streakDays, user.lastQuestCompletedAt, now);
    const longestStreakDays = Math.max(user.longestStreakDays, newStreak);
    const previousLevel = levelFromXp(user.xp);
    const newLevel = levelFromXp(user.xp + quest.xpReward);

    const completion = await tx.questCompletion.findUnique({
      where: { userId_questId: { userId, questId } },
      select: { startedAt: true, status: true },
    });
    if (!completion || completion.status === QuestCompletionStatus.COMPLETED) {
      throw new BadRequestException('Quest must be started before it can be completed');
    }

    const durationMin = Math.round((now.getTime() - completion.startedAt.getTime()) / 60000);
    const pathMeters = Math.round(this.sumPathDistanceMeters(quest.locations));

    const completionData: Prisma.QuestCompletionUpdateInput = {
      status: QuestCompletionStatus.COMPLETED,
      completedAt: now,
      xpAwarded: quest.xpReward,
      durationMin,
    };
    if (proof !== undefined) {
      completionData.proof = proof;
    }

    await tx.questCompletion.update({
      where: { userId_questId: { userId, questId } },
      data: completionData,
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        xp: { increment: quest.xpReward },
        questsDone: { increment: 1 },
        level: newLevel,
        streakDays: newStreak,
        longestStreakDays,
        lastQuestCompletedAt: now,
        distanceWalkedM: { increment: pathMeters },
      },
    });

    return {
      xpAwarded: quest.xpReward,
      previousLevel,
      newLevel,
      streakDays: newStreak,
      completedAt: now,
    };
  }

  private computeStreak(currentStreak: number, lastAt: Date | null, now: Date): number {
    if (!lastAt) return Math.max(1, currentStreak === 0 ? 1 : currentStreak);
    const hours = (now.getTime() - lastAt.getTime()) / (1000 * 60 * 60);
    if (hours <= STREAK_WINDOW_HOURS) return currentStreak;
    if (hours <= STREAK_RESET_HOURS) return currentStreak + 1;
    return 1;
  }

  private assertCanMutate(actor: { id: string; role: AppRole }, authorId: string | null): void {
    if (actor.role === AppRole.ADMIN || actor.role === AppRole.MODERATOR) return;
    if (authorId && authorId === actor.id) return;
    throw new ForbiddenException('Not allowed to mutate this quest');
  }

  private toDto(
    quest: QuestWithEnrichment,
    distanceFrom?: { latitude: number; longitude: number },
    checkedLocationIds?: Set<string>,
  ): QuestDto {
    const locations: QuestLocationDto[] = quest.locations.map((loc) => {
      const dto: QuestLocationDto = {
        id: loc.id,
        name: loc.name,
        address: loc.address,
        latitude: loc.latitude,
        longitude: loc.longitude,
        radiusM: loc.radiusM,
        orderIndex: loc.orderIndex,
      };
      if (distanceFrom) {
        dto.distanceM = Math.round(
          this.geo.haversineMeters(distanceFrom, {
            latitude: loc.latitude,
            longitude: loc.longitude,
          }),
        );
      }
      if (checkedLocationIds) {
        dto.isCompleted = checkedLocationIds.has(loc.id);
      }
      return dto;
    });

    return {
      id: quest.id,
      slug: quest.slug,
      title: quest.title,
      summary: quest.summary,
      description: quest.description,
      difficulty: quest.difficulty,
      status: quest.status,
      xpReward: quest.xpReward,
      estimatedDurationMin: quest.estimatedDurationMin,
      imageUrl: quest.imageUrl,
      coverImageUrl: quest.coverImageUrl,
      categoryId: quest.categoryId,
      businessId: quest.businessId,
      authorId: quest.authorId,
      publishedAt: quest.publishedAt,
      createdAt: quest.createdAt,
      updatedAt: quest.updatedAt,
      locations,
      tags: quest.tags,
      rating: quest.ratingAvg ?? null,
      ratingCount: quest.ratingCount,
      participantCount: quest._count.completions,
      participants: quest.completions.map((c) => ({
        id: c.user.id,
        username: c.user.username,
        displayName: c.user.displayName,
        avatarUrl: c.user.avatarUrl,
        level: c.user.level,
      })),
      category: quest.category
        ? QuestCategoryDto.fromEntity(quest.category, quest.category._count.quests)
        : null,
      rewards: {
        xp: quest.xpReward,
        achievements: quest.rewardAchievements.map((ra) => ({
          id: ra.achievement.id,
          slug: ra.achievement.slug,
          name: ra.achievement.name,
          iconUrl: ra.achievement.iconUrl,
          xpBonus: ra.achievement.xpBonus,
        })),
      },
    };
  }
}
