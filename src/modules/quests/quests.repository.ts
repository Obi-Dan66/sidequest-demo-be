import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { questCategoryPublishedCountInclude } from './quest-category-published.include';

const QUEST_INCLUDE = {
  locations: { orderBy: { orderIndex: 'asc' } },
  category: {
    include: questCategoryPublishedCountInclude,
  },
  _count: { select: { completions: true } },
  completions: {
    take: 6,
    orderBy: { startedAt: 'desc' },
    select: {
      user: {
        select: { id: true, username: true, displayName: true, avatarUrl: true, level: true },
      },
    },
  },
  rewardAchievements: {
    select: {
      achievement: {
        select: { id: true, slug: true, name: true, iconUrl: true, xpBonus: true },
      },
    },
  },
} satisfies Prisma.QuestInclude;

export type QuestWithEnrichment = Prisma.QuestGetPayload<{ include: typeof QUEST_INCLUDE }>;

@Injectable()
export class QuestsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<QuestWithEnrichment | null> {
    return this.prisma.quest.findUnique({
      where: { id },
      include: QUEST_INCLUDE,
    });
  }

  findBySlug(slug: string): Promise<QuestWithEnrichment | null> {
    return this.prisma.quest.findUnique({
      where: { slug },
      include: QUEST_INCLUDE,
    });
  }

  async list(params: {
    skip: number;
    take: number;
    where?: Prisma.QuestWhereInput;
    orderBy?: Prisma.QuestOrderByWithRelationInput;
  }): Promise<{ items: QuestWithEnrichment[]; total: number }> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.quest.findMany({
        skip: params.skip,
        take: params.take,
        where: params.where,
        orderBy: params.orderBy ?? { createdAt: 'desc' },
        include: QUEST_INCLUDE,
      }),
      this.prisma.quest.count({ where: params.where }),
    ]);
    return { items, total };
  }

  create(data: Prisma.QuestCreateInput): Promise<QuestWithEnrichment> {
    return this.prisma.quest.create({
      data,
      include: QUEST_INCLUDE,
    });
  }

  update(id: string, data: Prisma.QuestUpdateInput): Promise<QuestWithEnrichment> {
    return this.prisma.quest.update({
      where: { id },
      data,
      include: QUEST_INCLUDE,
    });
  }

  delete(id: string): Promise<QuestWithEnrichment> {
    return this.prisma.quest.delete({
      where: { id },
      include: QUEST_INCLUDE,
    });
  }

  findWithinBoundingBox(params: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
    where?: Prisma.QuestWhereInput;
    limit?: number;
  }): Promise<QuestWithEnrichment[]> {
    return this.prisma.quest.findMany({
      where: {
        ...params.where,
        locations: {
          some: {
            latitude: { gte: params.minLat, lte: params.maxLat },
            longitude: { gte: params.minLng, lte: params.maxLng },
          },
        },
      },
      include: QUEST_INCLUDE,
      take: params.limit ?? 100,
    });
  }
}
