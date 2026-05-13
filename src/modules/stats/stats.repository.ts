import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface PlatformCountsRow {
  totalExplorers: number;
  totalQuests: number;
  totalQuestCompletions: number;
  totalDistanceM: bigint | number | null;
}

export interface CityExplorerRow {
  slug: string;
  explorers: number;
}

@Injectable()
export class StatsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Single round-trip for headline counters (ACTIVE users, PUBLISHED quests, completed rows, walked meters).
   */
  async loadPlatformCounts(): Promise<PlatformCountsRow> {
    const rows = await this.prisma.$queryRaw<PlatformCountsRow[]>(Prisma.sql`
      SELECT
        (SELECT COUNT(*)::integer FROM "User" WHERE "status" = 'ACTIVE'::"UserStatus") AS "totalExplorers",
        (SELECT COUNT(*)::integer FROM "Quest" WHERE "status" = 'PUBLISHED'::"QuestStatus") AS "totalQuests",
        (SELECT COUNT(*)::integer FROM "QuestCompletion" WHERE "status" = 'COMPLETED'::"QuestCompletionStatus") AS "totalQuestCompletions",
        (SELECT COALESCE(SUM("distanceWalkedM"), 0) FROM "User" WHERE "status" = 'ACTIVE'::"UserStatus") AS "totalDistanceM"
    `);
    const row = rows[0];
    if (!row) {
      return {
        totalExplorers: 0,
        totalQuests: 0,
        totalQuestCompletions: 0,
        totalDistanceM: 0,
      };
    }
    return row;
  }

  async loadCityExplorerCounts(): Promise<CityExplorerRow[]> {
    return this.prisma.$queryRaw<CityExplorerRow[]>(Prisma.sql`
      SELECT
        LOWER(BTRIM("primaryCity")) AS "slug",
        COUNT(*)::integer AS "explorers"
      FROM "User"
      WHERE "status" = 'ACTIVE'::"UserStatus"
        AND BTRIM("primaryCity") <> ''
      GROUP BY LOWER(BTRIM("primaryCity"))
      ORDER BY "explorers" DESC, "slug" ASC
    `);
  }
}
