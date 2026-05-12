import { Injectable } from '@nestjs/common';
import { Achievement, UserAchievement } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AchievementsRepository {
  constructor(private readonly prisma: PrismaService) {}

  listAll(): Promise<Achievement[]> {
    return this.prisma.achievement.findMany({ orderBy: { createdAt: 'asc' } });
  }

  listForUser(userId: string): Promise<(UserAchievement & { achievement: Achievement })[]> {
    return this.prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: true },
      orderBy: { unlockedAt: 'desc' },
    });
  }

  findUserAchievement(userId: string, achievementId: string): Promise<UserAchievement | null> {
    return this.prisma.userAchievement.findUnique({
      where: { userId_achievementId: { userId, achievementId } },
    });
  }

  unlock(userId: string, achievementId: string): Promise<UserAchievement> {
    return this.prisma.userAchievement.create({
      data: { userId, achievementId },
    });
  }
}
