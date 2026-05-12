import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, QuestStatus } from '@prisma/client';
import { PaginatedResult, paginate } from '../../common/responses/api-response';
import { EventsBus } from '../events/events.bus';
import { AppEvents } from '../events/events.types';
import { GeoService } from '../geo/geo.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateQuestDto } from './dto/create-quest.dto';
import { ListQuestsDto, ListQuestsNearbyDto } from './dto/list-quests.dto';
import { QuestDto } from './dto/quest.dto';
import { QuestCompletionsRepository } from './quest-completions.repository';
import { QuestWithLocations, QuestsRepository } from './quests.repository';

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

    const refined = candidates.filter((quest) =>
      quest.locations.some((loc) =>
        this.geo.isWithinRadius(
          center,
          { latitude: loc.latitude, longitude: loc.longitude },
          radius,
        ),
      ),
    );

    return refined.map((q) => this.toDto(q));
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

  async start(userId: string, questId: string): Promise<void> {
    const quest = await this.quests.findById(questId);
    if (!quest) throw new NotFoundException('Quest not found');
    if (quest.status !== QuestStatus.PUBLISHED) {
      throw new BadRequestException('Quest is not available');
    }
    await this.completions.start(userId, questId);
    this.events.emit(AppEvents.QuestStarted, { userId, questId });
  }

  async complete(userId: string, questId: string, proof?: Prisma.InputJsonValue): Promise<void> {
    const quest = await this.quests.findById(questId);
    if (!quest) throw new NotFoundException('Quest not found');

    const active = await this.completions.findActive(userId, questId);
    if (!active || active.status === 'COMPLETED') {
      throw new BadRequestException('Quest must be started before it can be completed');
    }

    await this.prisma.runInTransaction(async (tx) => {
      await tx.questCompletion.update({
        where: { userId_questId: { userId, questId } },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          xpAwarded: quest.xpReward,
          proof,
        },
      });
      await tx.user.update({
        where: { id: userId },
        data: {
          xp: { increment: quest.xpReward },
          questsDone: { increment: 1 },
        },
      });
    });

    this.events.emit(AppEvents.QuestCompleted, {
      userId,
      questId,
      xpAwarded: quest.xpReward,
      completedAt: new Date(),
    });
  }

  private toDto(quest: QuestWithLocations): QuestDto {
    return QuestDto.fromEntity(
      quest,
      quest.locations.map((loc) => ({
        id: loc.id,
        name: loc.name,
        address: loc.address,
        latitude: loc.latitude,
        longitude: loc.longitude,
        radiusM: loc.radiusM,
        orderIndex: loc.orderIndex,
      })),
    );
  }
}
