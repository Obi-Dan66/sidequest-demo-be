import { Injectable } from '@nestjs/common';
import { Prisma, Quest, QuestLocation } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface QuestWithLocations extends Quest {
  locations: QuestLocation[];
}

@Injectable()
export class QuestsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<QuestWithLocations | null> {
    return this.prisma.quest.findUnique({
      where: { id },
      include: { locations: { orderBy: { orderIndex: 'asc' } } },
    });
  }

  findBySlug(slug: string): Promise<QuestWithLocations | null> {
    return this.prisma.quest.findUnique({
      where: { slug },
      include: { locations: { orderBy: { orderIndex: 'asc' } } },
    });
  }

  async list(params: {
    skip: number;
    take: number;
    where?: Prisma.QuestWhereInput;
    orderBy?: Prisma.QuestOrderByWithRelationInput;
  }): Promise<{ items: QuestWithLocations[]; total: number }> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.quest.findMany({
        skip: params.skip,
        take: params.take,
        where: params.where,
        orderBy: params.orderBy ?? { createdAt: 'desc' },
        include: { locations: { orderBy: { orderIndex: 'asc' } } },
      }),
      this.prisma.quest.count({ where: params.where }),
    ]);
    return { items, total };
  }

  create(data: Prisma.QuestCreateInput): Promise<QuestWithLocations> {
    return this.prisma.quest.create({
      data,
      include: { locations: { orderBy: { orderIndex: 'asc' } } },
    });
  }

  update(id: string, data: Prisma.QuestUpdateInput): Promise<QuestWithLocations> {
    return this.prisma.quest.update({
      where: { id },
      data,
      include: { locations: { orderBy: { orderIndex: 'asc' } } },
    });
  }

  /**
   * Bounding-box prefilter using indexed (latitude, longitude) columns.
   * Caller refines distance using GeoService.haversineMeters().
   */
  findWithinBoundingBox(params: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
    where?: Prisma.QuestWhereInput;
    limit?: number;
  }): Promise<QuestWithLocations[]> {
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
      include: { locations: { orderBy: { orderIndex: 'asc' } } },
      take: params.limit ?? 100,
    });
  }
}
