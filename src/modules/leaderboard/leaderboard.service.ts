import { BadRequestException, Injectable } from '@nestjs/common';
import { ParticipantSummaryDto } from '../../common/dto/participant-summary.dto';
import {
  LeaderboardQueryDto,
  LeaderboardPeriod,
  LeaderboardScope,
} from './dto/leaderboard-query.dto';
import { LeaderboardEntryDto, LeaderboardResponseDto } from './dto/leaderboard-response.dto';
import { LeaderboardRepository, LeaderboardSqlRow } from './leaderboard.repository';

function toRankNumber(value: bigint | number): number {
  return typeof value === 'bigint' ? Number(value) : value;
}

/**
 * MONTH: calendar month (UTC). WEEK: ISO week starting Monday 00:00 UTC.
 */
export function leaderboardPeriodStartUtc(period: LeaderboardPeriod): Date | null {
  if (period === LeaderboardPeriod.ALL_TIME) return null;
  const now = new Date();
  if (period === LeaderboardPeriod.MONTH) {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  }
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const wd = d.getUTCDay();
  const mondayOffset = wd === 0 ? -6 : 1 - wd;
  d.setUTCDate(d.getUTCDate() + mondayOffset);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

@Injectable()
export class LeaderboardService {
  constructor(private readonly repo: LeaderboardRepository) {}

  async get(query: LeaderboardQueryDto, viewerId?: string): Promise<LeaderboardResponseDto> {
    const scope = query.scope ?? LeaderboardScope.GLOBAL;
    const period = query.period ?? LeaderboardPeriod.ALL_TIME;
    const limit = query.limit;

    if (scope === LeaderboardScope.CITY) {
      const c = query.city?.trim();
      if (!c) {
        throw new BadRequestException('city is required when scope=CITY');
      }
    }

    const cityLower = scope === LeaderboardScope.CITY ? query.city!.trim().toLowerCase() : null;
    const periodStart = leaderboardPeriodStartUtc(period);

    const rows =
      periodStart === null
        ? await this.repo.listTopAllTime(cityLower, limit)
        : await this.repo.listTopPeriod(periodStart, cityLower, limit);

    const entries = rows.map((r) => this.toEntry(r, viewerId));

    let myEntry: LeaderboardEntryDto | null = null;
    if (viewerId) {
      const inTop = entries.find((e) => e.user.id === viewerId);
      if (inTop) {
        myEntry = inTop;
      } else {
        const mine =
          periodStart === null
            ? await this.repo.findMyRankAllTime(cityLower, viewerId)
            : await this.repo.findMyRankPeriod(periodStart, cityLower, viewerId);
        myEntry = mine ? this.toEntry(mine, viewerId) : null;
      }
    }

    return { entries, myEntry };
  }

  private toEntry(row: LeaderboardSqlRow, viewerId?: string): LeaderboardEntryDto {
    const user: ParticipantSummaryDto = {
      id: row.id,
      username: row.username,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      level: row.level,
    };
    return {
      rank: toRankNumber(row.rank),
      user,
      xp: row.xp,
      questsDone: row.quests_done,
      isMe: viewerId !== undefined && row.id === viewerId,
    };
  }
}
