import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, QuestStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GeoService } from '../geo/geo.service';
import { MapBoundsQueryDto } from './dto/map-query.dto';
import { MapPinDto } from './dto/map-pin.dto';

const QUEST_LOCATION_PIN_SELECT = Prisma.validator<Prisma.QuestLocationFindManyArgs>()({
  include: {
    quest: {
      select: {
        id: true,
        title: true,
        difficulty: true,
        imageUrl: true,
        category: { select: { slug: true, colorHex: true } },
      },
    },
  },
});

type QuestLocationPinRow = Prisma.QuestLocationGetPayload<typeof QUEST_LOCATION_PIN_SELECT>;

const BUSINESS_PIN_SELECT = Prisma.validator<Prisma.BusinessFindManyArgs>()({
  select: {
    id: true,
    name: true,
    latitude: true,
    longitude: true,
    logoUrl: true,
  },
});

type BusinessPinRow = Prisma.BusinessGetPayload<typeof BUSINESS_PIN_SELECT>;

const ALL_KINDS = new Set(['QUEST', 'BUSINESS']);

/**
 * Map module produces lightweight pins for client-side rendering.
 * Geo strategy: bounding-box filter on indexed lat/lng columns + optional
 * distance refinement using the viewport centre.
 */
@Injectable()
export class MapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geo: GeoService,
  ) {}

  async getPinsInBounds(query: MapBoundsQueryDto): Promise<MapPinDto[]> {
    const { south, north, west, east } = query;
    if (south === undefined || north === undefined || west === undefined || east === undefined) {
      throw new BadRequestException('south, north, west, east are all required');
    }
    if (south >= north || west >= east) {
      throw new BadRequestException('Invalid bounds: south<north and west<east required');
    }

    const limit = query.limit ?? 200;
    const kinds = this.parseKinds(query.kinds);

    const questWhere: Prisma.QuestWhereInput = {
      status: QuestStatus.PUBLISHED,
      difficulty: query.difficulty,
      category: query.categorySlug ? { slug: query.categorySlug } : undefined,
    };

    const wantQuests = kinds.has('QUEST');
    const wantBusinesses = kinds.has('BUSINESS') && !query.categorySlug && !query.difficulty;

    const questRowsPromise: Promise<QuestLocationPinRow[]> = wantQuests
      ? this.prisma.questLocation.findMany({
          where: {
            latitude: { gte: south, lte: north },
            longitude: { gte: west, lte: east },
            quest: questWhere,
          },
          include: QUEST_LOCATION_PIN_SELECT.include,
          take: limit,
        })
      : Promise.resolve([]);

    const businessRowsPromise: Promise<BusinessPinRow[]> = wantBusinesses
      ? this.prisma.business.findMany({
          where: {
            status: 'VERIFIED',
            latitude: { gte: south, lte: north, not: null },
            longitude: { gte: west, lte: east, not: null },
          },
          select: BUSINESS_PIN_SELECT.select,
          take: limit,
        })
      : Promise.resolve([]);

    const [questRows, businessRows] = await Promise.all([questRowsPromise, businessRowsPromise]);

    const pins: MapPinDto[] = [
      ...questRows.map((row) => this.buildQuestPin(row)),
      ...businessRows
        .map((row) => this.buildBusinessPin(row))
        .filter((p): p is MapPinDto => p !== null),
    ];

    this.attachDistance(pins, south, north, west, east);
    return pins;
  }

  private buildQuestPin(row: QuestLocationPinRow): MapPinDto {
    const pin: MapPinDto = {
      id: row.id,
      kind: 'QUEST',
      latitude: row.latitude,
      longitude: row.longitude,
      title: row.quest.title,
      refId: row.quest.id,
      difficulty: row.quest.difficulty,
      imageUrl: row.quest.imageUrl,
    };
    if (row.quest.category) {
      pin.categorySlug = row.quest.category.slug;
      pin.colorHex = row.quest.category.colorHex ?? undefined;
    }
    return pin;
  }

  private buildBusinessPin(row: BusinessPinRow): MapPinDto | null {
    if (row.latitude === null || row.longitude === null) return null;
    return {
      id: row.id,
      kind: 'BUSINESS',
      latitude: row.latitude,
      longitude: row.longitude,
      title: row.name,
      refId: row.id,
      imageUrl: row.logoUrl,
    };
  }

  private attachDistance(
    pins: MapPinDto[],
    south: number,
    north: number,
    west: number,
    east: number,
  ): void {
    const center = {
      latitude: (south + north) / 2,
      longitude: (west + east) / 2,
    };
    for (const pin of pins) {
      pin.distanceM = Math.round(
        this.geo.haversineMeters(center, {
          latitude: pin.latitude,
          longitude: pin.longitude,
        }),
      );
    }
  }

  private parseKinds(raw: string | undefined): Set<string> {
    if (!raw) return ALL_KINDS;
    const out = new Set<string>();
    for (const piece of raw.split(',')) {
      const trimmed = piece.trim().toUpperCase();
      if (ALL_KINDS.has(trimmed)) out.add(trimmed);
    }
    return out.size === 0 ? ALL_KINDS : out;
  }
}
