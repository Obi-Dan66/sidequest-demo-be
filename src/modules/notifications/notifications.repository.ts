import { Injectable } from '@nestjs/common';
import { Notification, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.NotificationCreateInput): Promise<Notification> {
    return this.prisma.notification.create({ data });
  }

  async listForUser(
    userId: string,
    skip: number,
    take: number,
  ): Promise<{ items: Notification[]; total: number }> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);
    return { items, total };
  }

  markRead(id: string, userId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
  }

  markAllRead(userId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
