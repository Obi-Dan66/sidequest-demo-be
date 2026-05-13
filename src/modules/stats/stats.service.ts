import { Injectable } from '@nestjs/common';
import { QuestStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QuestDto } from '../quests/dto/quest.dto';
import { QuestsService } from '../quests/quests.service';
import { PublicStatsCityDto, PublicStatsDto } from './dto/public-stats.dto';
import { StatsRepository } from './stats.repository';

const CACHE_TTL_MS = 300_000;

function metersToKm(m: bigint | number): number {
  const n = typeof m === 'bigint' ? Number(m) : m;
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round((n / 1000) * 1000) / 1000;
}

function displayNameFromCitySlug(slug: string): string {
  const s = slug.trim();
  if (!s) return s;
  return s
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

@Injectable()
export class StatsService {
  private cache: { expiresAt: number; payload: PublicStatsDto } | null = null;

  constructor(
    private readonly repo: StatsRepository,
    private readonly prisma: PrismaService,
    private readonly questsService: QuestsService,
  ) {}

  async getPublicStats(): Promise<PublicStatsDto> {
    const now = Date.now();
    if (this.cache && now < this.cache.expiresAt) {
      return this.cache.payload;
    }

    const [counts, cityRows, featuredQuest] = await Promise.all([
      this.repo.loadPlatformCounts(),
      this.repo.loadCityExplorerCounts(),
      this.resolveFeaturedQuestDto(),
    ]);

    const totalDistanceM = counts.totalDistanceM ?? 0;

    const cities: PublicStatsCityDto[] = cityRows.map((r) => ({
      slug: r.slug,
      name: displayNameFromCitySlug(r.slug),
      explorers: r.explorers,
    }));

    const payload: PublicStatsDto = {
      totalExplorers: counts.totalExplorers,
      totalQuests: counts.totalQuests,
      totalQuestCompletions: counts.totalQuestCompletions,
      totalDistanceKm: metersToKm(totalDistanceM),
      cities,
      featuredQuest,
    };

    this.cache = { expiresAt: now + CACHE_TTL_MS, payload };
    return payload;
  }

  private async resolveFeaturedQuestDto(): Promise<QuestDto | null> {
    const flagged = await this.prisma.quest.findFirst({
      where: { status: QuestStatus.PUBLISHED, featuredAt: { not: null } },
      orderBy: { featuredAt: 'desc' },
      select: { id: true },
    });
    let id = flagged?.id;
    if (!id) {
      const rated = await this.prisma.quest.findFirst({
        where: { status: QuestStatus.PUBLISHED, ratingCount: { gt: 0 } },
        orderBy: [{ ratingAvg: 'desc' }, { ratingCount: 'desc' }, { createdAt: 'desc' }],
        select: { id: true },
      });
      id = rated?.id;
    }
    if (!id) {
      const anyPublished = await this.prisma.quest.findFirst({
        where: { status: QuestStatus.PUBLISHED },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      id = anyPublished?.id;
    }
    if (!id) return null;
    return this.questsService.getById(id, undefined);
  }
}
