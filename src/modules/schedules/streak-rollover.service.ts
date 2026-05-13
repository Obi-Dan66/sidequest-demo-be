import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

@Injectable()
export class StreakRolloverService {
  private readonly logger = new Logger(StreakRolloverService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 0 * * *', { timeZone: 'Etc/UTC' })
  async resetStaleStreaksUtc(): Promise<void> {
    const startOfTodayUtc = startOfUtcDay(new Date());
    const cutoff = new Date(startOfTodayUtc.getTime() - 86_400_000);

    const result = await this.prisma.user.updateMany({
      where: {
        streakDays: { gt: 0 },
        OR: [{ lastQuestCompletedAt: null }, { lastQuestCompletedAt: { lt: cutoff } }],
      },
      data: { streakDays: 0 },
    });

    this.logger.log(`UTC streak rollover: cleared streakDays for ${result.count} user(s)`);
  }
}
