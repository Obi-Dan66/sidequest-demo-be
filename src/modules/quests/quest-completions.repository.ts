import { Injectable } from '@nestjs/common';
import { Prisma, QuestCompletion, QuestCompletionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class QuestCompletionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActive(userId: string, questId: string): Promise<QuestCompletion | null> {
    return this.prisma.questCompletion.findUnique({
      where: { userId_questId: { userId, questId } },
    });
  }

  start(userId: string, questId: string): Promise<QuestCompletion> {
    return this.prisma.questCompletion.upsert({
      where: { userId_questId: { userId, questId } },
      update: { status: QuestCompletionStatus.STARTED, startedAt: new Date() },
      create: { userId, questId, status: QuestCompletionStatus.STARTED },
    });
  }

  complete(
    userId: string,
    questId: string,
    xpAwarded: number,
    proof?: Prisma.InputJsonValue,
  ): Promise<QuestCompletion> {
    return this.prisma.questCompletion.update({
      where: { userId_questId: { userId, questId } },
      data: {
        status: QuestCompletionStatus.COMPLETED,
        completedAt: new Date(),
        xpAwarded,
        proof,
      },
    });
  }

  abandon(userId: string, questId: string): Promise<QuestCompletion> {
    return this.prisma.questCompletion.update({
      where: { userId_questId: { userId, questId } },
      data: { status: QuestCompletionStatus.ABANDONED },
    });
  }

  countCompletedForUser(userId: string): Promise<number> {
    return this.prisma.questCompletion.count({
      where: { userId, status: QuestCompletionStatus.COMPLETED },
    });
  }
}
