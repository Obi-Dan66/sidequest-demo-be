import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

function toFiniteNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'bigint') return Number(value);
  if (value !== null && typeof value === 'object' && 'toNumber' in value) {
    const fn = Reflect.get(value, 'toNumber');
    if (typeof fn === 'function') {
      const out: unknown = Reflect.apply(fn, value, []);
      if (typeof out === 'number' && Number.isFinite(out)) return out;
    }
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

export interface TopQuestSqlRow {
  id: string;
  title: string;
  visits: number;
  completions: number;
  rating: number | null;
  rating_count: number;
}

@Injectable()
export class BusinessPortalRepository {
  constructor(private readonly prisma: PrismaService) {}

  async countVisits(businessId: string, start: Date, endExclusive: Date): Promise<number> {
    const rows = await this.prisma.$queryRaw<[{ c: bigint }]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS c
      FROM "BusinessVisit"
      WHERE "businessId" = ${businessId}
        AND "createdAt" >= ${start}
        AND "createdAt" < ${endExclusive}
    `);
    return Number(rows[0]?.c ?? 0);
  }

  async countQuestCompletions(
    businessId: string,
    start: Date,
    endExclusive: Date,
  ): Promise<number> {
    const rows = await this.prisma.$queryRaw<[{ c: bigint }]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS c
      FROM "QuestCompletion" qc
      INNER JOIN "Quest" q ON q.id = qc."questId"
      WHERE q."businessId" = ${businessId}
        AND qc."status" = 'COMPLETED'::"QuestCompletionStatus"
        AND qc."completedAt" IS NOT NULL
        AND qc."completedAt" >= ${start}
        AND qc."completedAt" < ${endExclusive}
    `);
    return Number(rows[0]?.c ?? 0);
  }

  async averageRatingInPeriod(
    businessId: string,
    start: Date,
    endExclusive: Date,
  ): Promise<number> {
    const rows = await this.prisma.$queryRaw<[{ avg: unknown }]>(Prisma.sql`
      SELECT AVG(qr.score) AS avg
      FROM "QuestRating" qr
      INNER JOIN "Quest" q ON q.id = qr."questId"
      WHERE q."businessId" = ${businessId}
        AND qr."createdAt" >= ${start}
        AND qr."createdAt" < ${endExclusive}
    `);
    const raw = rows[0]?.avg;
    return Math.round(toFiniteNumber(raw) * 100) / 100;
  }

  async repeatVisitorPercent(businessId: string, start: Date, endExclusive: Date): Promise<number> {
    const rows = await this.prisma.$queryRaw<[{ pct: unknown }]>(Prisma.sql`
      WITH visits AS (
        SELECT "userId", COUNT(*)::integer AS cnt
        FROM "BusinessVisit"
        WHERE "businessId" = ${businessId}
          AND "userId" IS NOT NULL
          AND "createdAt" >= ${start}
          AND "createdAt" < ${endExclusive}
        GROUP BY "userId"
      ),
      agg AS (
        SELECT
          COUNT(*) FILTER (WHERE cnt > 1)::numeric AS repeat_users,
          COUNT(*)::numeric AS distinct_users
        FROM visits
      )
      SELECT CASE
        WHEN distinct_users = 0 THEN 0::numeric
        ELSE (repeat_users / distinct_users * 100)
      END AS pct
      FROM agg
    `);
    const raw = rows[0]?.pct;
    return Math.round(toFiniteNumber(raw) * 100) / 100;
  }

  async listTopQuests(
    businessId: string,
    start: Date,
    endExclusive: Date,
    limit: number,
  ): Promise<TopQuestSqlRow[]> {
    return this.prisma.$queryRaw<TopQuestSqlRow[]>(Prisma.sql`
      SELECT
        q.id,
        q.title,
        (
          SELECT COUNT(*)::integer
          FROM "BusinessVisit" bv
          WHERE bv."questId" = q.id
            AND bv."businessId" = ${businessId}
            AND bv."createdAt" >= ${start}
            AND bv."createdAt" < ${endExclusive}
        ) AS visits,
        (
          SELECT COUNT(*)::integer
          FROM "QuestCompletion" qc
          WHERE qc."questId" = q.id
            AND qc."status" = 'COMPLETED'::"QuestCompletionStatus"
            AND qc."completedAt" IS NOT NULL
            AND qc."completedAt" >= ${start}
            AND qc."completedAt" < ${endExclusive}
        ) AS completions,
        q."ratingAvg" AS rating,
        q."ratingCount" AS rating_count
      FROM "Quest" q
      WHERE q."businessId" = ${businessId}
      ORDER BY visits DESC, completions DESC, q.title ASC
      LIMIT ${limit}
    `);
  }
}
