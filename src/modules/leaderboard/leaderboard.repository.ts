import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface LeaderboardSqlRow {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  level: number;
  xp: number;
  quests_done: number;
  createdAt: Date;
  rank: bigint | number;
}

@Injectable()
export class LeaderboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  private cityFilter(cityLower: string | null): Prisma.Sql {
    if (cityLower === null) return Prisma.empty;
    return Prisma.sql`AND LOWER(BTRIM(u."primaryCity")) = ${cityLower}`;
  }

  async listTopAllTime(cityLower: string | null, limit: number): Promise<LeaderboardSqlRow[]> {
    const city = this.cityFilter(cityLower);
    return this.prisma.$queryRaw<LeaderboardSqlRow[]>(Prisma.sql`
      WITH base AS (
        SELECT
          u."id",
          u."username",
          u."displayName",
          u."avatarUrl",
          u."level",
          u."xp" AS xp,
          u."questsDone" AS quests_done,
          u."createdAt"
        FROM "User" u
        WHERE u."status" = 'ACTIVE'::"UserStatus"
        ${city}
      ),
      ranked AS (
        SELECT
          b.*,
          ROW_NUMBER() OVER (ORDER BY b.xp DESC, b.level DESC, b."createdAt" ASC) AS rank
        FROM base b
      )
      SELECT * FROM ranked WHERE rank <= ${limit}
      ORDER BY rank ASC
    `);
  }

  async findMyRankAllTime(
    cityLower: string | null,
    userId: string,
  ): Promise<LeaderboardSqlRow | null> {
    const city = this.cityFilter(cityLower);
    const rows = await this.prisma.$queryRaw<LeaderboardSqlRow[]>(Prisma.sql`
      WITH base AS (
        SELECT
          u."id",
          u."username",
          u."displayName",
          u."avatarUrl",
          u."level",
          u."xp" AS xp,
          u."questsDone" AS quests_done,
          u."createdAt"
        FROM "User" u
        WHERE u."status" = 'ACTIVE'::"UserStatus"
        ${city}
      ),
      ranked AS (
        SELECT
          b.*,
          ROW_NUMBER() OVER (ORDER BY b.xp DESC, b.level DESC, b."createdAt" ASC) AS rank
        FROM base b
      )
      SELECT * FROM ranked WHERE id = ${userId}
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  async listTopPeriod(
    periodStart: Date,
    cityLower: string | null,
    limit: number,
  ): Promise<LeaderboardSqlRow[]> {
    const city = this.cityFilter(cityLower);
    return this.prisma.$queryRaw<LeaderboardSqlRow[]>(Prisma.sql`
      WITH agg AS (
        SELECT
          u."id",
          u."username",
          u."displayName",
          u."avatarUrl",
          u."level",
          COALESCE(SUM(qc."xpAwarded"), 0)::integer AS xp,
          COUNT(qc."id")::integer AS quests_done,
          u."createdAt"
        FROM "User" u
        LEFT JOIN "QuestCompletion" qc
          ON qc."userId" = u."id"
          AND qc."status" = 'COMPLETED'::"QuestCompletionStatus"
          AND qc."completedAt" IS NOT NULL
          AND qc."completedAt" >= ${periodStart}
        WHERE u."status" = 'ACTIVE'::"UserStatus"
        ${city}
        GROUP BY u."id", u."username", u."displayName", u."avatarUrl", u."level", u."createdAt"
      ),
      ranked AS (
        SELECT
          a.*,
          ROW_NUMBER() OVER (ORDER BY a.xp DESC, a.level DESC, a."createdAt" ASC) AS rank
        FROM agg a
      )
      SELECT * FROM ranked WHERE rank <= ${limit}
      ORDER BY rank ASC
    `);
  }

  async findMyRankPeriod(
    periodStart: Date,
    cityLower: string | null,
    userId: string,
  ): Promise<LeaderboardSqlRow | null> {
    const city = this.cityFilter(cityLower);
    const rows = await this.prisma.$queryRaw<LeaderboardSqlRow[]>(Prisma.sql`
      WITH agg AS (
        SELECT
          u."id",
          u."username",
          u."displayName",
          u."avatarUrl",
          u."level",
          COALESCE(SUM(qc."xpAwarded"), 0)::integer AS xp,
          COUNT(qc."id")::integer AS quests_done,
          u."createdAt"
        FROM "User" u
        LEFT JOIN "QuestCompletion" qc
          ON qc."userId" = u."id"
          AND qc."status" = 'COMPLETED'::"QuestCompletionStatus"
          AND qc."completedAt" IS NOT NULL
          AND qc."completedAt" >= ${periodStart}
        WHERE u."status" = 'ACTIVE'::"UserStatus"
        ${city}
        GROUP BY u."id", u."username", u."displayName", u."avatarUrl", u."level", u."createdAt"
      ),
      ranked AS (
        SELECT
          a.*,
          ROW_NUMBER() OVER (ORDER BY a.xp DESC, a.level DESC, a."createdAt" ASC) AS rank
        FROM agg a
      )
      SELECT * FROM ranked WHERE id = ${userId}
      LIMIT 1
    `);
    return rows[0] ?? null;
  }
}
