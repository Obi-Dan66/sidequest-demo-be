import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, QuestStatus } from '@prisma/client';
import { AppRole } from '../../common/auth/roles.enum';
import { levelFromXp } from '../../common/gamification/xp';
import { PaginatedResult, paginate } from '../../common/responses/api-response';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsBus } from '../events/events.bus';
import { AppEvents } from '../events/events.types';
import { GeoService } from '../geo/geo.service';
import { CreateQuestDto } from './dto/create-quest.dto';
import { ListQuestsDto, ListQuestsNearbyDto } from './dto/list-quests.dto';
import { QuestDto, QuestLocationDto } from './dto/quest.dto';
import { UpdateQuestDto } from './dto/update-quest.dto';
import { QuestCompletionsRepository } from './quest-completions.repository';
import { QuestWithLocations, QuestsRepository } from './quests.repository';

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

    const refined: Array<{ quest: QuestWithLocations; distance: number }> = [];
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

  async getById(id: string): Promise<QuestDto> {
    const quest = await this.quests.findById(id);
    if (!quest) throw new NotFoundException('Quest not found');
    return this.toDto(quest);
  }

  async getBySlug(slug: string): Promise<QuestDto> {
    const quest = await this.quests.findBySlug(slug);
    if (!quest) throw new NotFoundException('Quest not found');
    return this.toDto(quest);
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

    const result = await this.prisma.runInTransaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { xp: true, streakDays: true, lastQuestCompletedAt: true },
      });
      if (!user) throw new NotFoundException('User not found');

      const now = new Date();
      const newStreak = this.computeStreak(user.streakDays, user.lastQuestCompletedAt, now);
      const previousLevel = levelFromXp(user.xp);
      const newXp = user.xp + quest.xpReward;
      const newLevel = levelFromXp(newXp);

      await tx.questCompletion.update({
        where: { userId_questId: { userId, questId } },
        data: {
          status: 'COMPLETED',
          completedAt: now,
          xpAwarded: quest.xpReward,
          proof,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          xp: { increment: quest.xpReward },
          questsDone: { increment: 1 },
          level: newLevel,
          streakDays: newStreak,
          lastQuestCompletedAt: now,
        },
      });

      return {
        xpAwarded: quest.xpReward,
        previousLevel,
        newLevel,
        streakDays: newStreak,
        completedAt: now,
      };
    });

    this.events.emit(AppEvents.QuestCompleted, {
      userId,
      questId,
      xpAwarded: result.xpAwarded,
      completedAt: result.completedAt,
    });

    return {
      xpAwarded: result.xpAwarded,
      leveledUp: result.newLevel > result.previousLevel,
      newLevel: result.newLevel,
      streakDays: result.streakDays,
    };
  }

  private computeStreak(currentStreak: number, lastAt: Date | null, now: Date): number {
    if (!lastAt) return Math.max(1, currentStreak === 0 ? 1 : currentStreak);
    const hours = (now.getTime() - lastAt.getTime()) / (1000 * 60 * 60);
    if (hours <= STREAK_WINDOW_HOURS) return currentStreak; // same window, no double-count
    if (hours <= STREAK_RESET_HOURS) return currentStreak + 1;
    return 1;
  }

  private assertCanMutate(actor: { id: string; role: AppRole }, authorId: string | null): void {
    if (actor.role === AppRole.ADMIN || actor.role === AppRole.MODERATOR) return;
    if (authorId && authorId === actor.id) return;
    throw new ForbiddenException('Not allowed to mutate this quest');
  }

  private toDto(
    quest: QuestWithLocations,
    distanceFrom?: { latitude: number; longitude: number },
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
      return dto;
    });
    return QuestDto.fromEntity(quest, locations);
  }
}
