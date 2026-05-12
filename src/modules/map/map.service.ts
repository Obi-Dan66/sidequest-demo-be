import { BadRequestException, Injectable } from '@nestjs/common';
import { QuestStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MapBoundsQueryDto } from './dto/map-query.dto';
import { MapPinDto } from './dto/map-pin.dto';

/**
 * Map module produces lightweight pins for client-side rendering.
 * Geo strategy: bounding-box filter on indexed lat/lng columns.
 */
@Injectable()
export class MapService {
  constructor(private readonly prisma: PrismaService) {}

  async getPinsInBounds(query: MapBoundsQueryDto): Promise<MapPinDto[]> {
    const { south, north, west, east } = query;
    if (south === undefined || north === undefined || west === undefined || east === undefined) {
      throw new BadRequestException('south, north, west, east are all required');
    }
    if (south >= north || west >= east) {
      throw new BadRequestException('Invalid bounds: south<north and west<east required');
    }

    const limit = query.limit ?? 200;

    const [questLocs, businesses] = await this.prisma.$transaction([
      this.prisma.questLocation.findMany({
        where: {
          latitude: { gte: south, lte: north },
          longitude: { gte: west, lte: east },
          quest: { status: QuestStatus.PUBLISHED },
        },
        include: { quest: { select: { id: true, title: true } } },
        take: limit,
      }),
      this.prisma.business.findMany({
        where: {
          status: 'VERIFIED',
          latitude: { gte: south, lte: north, not: null },
          longitude: { gte: west, lte: east, not: null },
        },
        select: { id: true, name: true, latitude: true, longitude: true },
        take: limit,
      }),
    ]);

    const questPins: MapPinDto[] = questLocs.map((loc) => ({
      id: loc.id,
      kind: 'QUEST',
      latitude: loc.latitude,
      longitude: loc.longitude,
      title: loc.quest.title,
      refId: loc.quest.id,
    }));

    const businessPins: MapPinDto[] = [];
    for (const b of businesses) {
      if (b.latitude === null || b.longitude === null) continue;
      businessPins.push({
        id: b.id,
        kind: 'BUSINESS',
        latitude: b.latitude,
        longitude: b.longitude,
        title: b.name,
        refId: b.id,
      });
    }

    return [...questPins, ...businessPins];
  }
}
