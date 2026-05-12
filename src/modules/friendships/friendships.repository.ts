import { Injectable } from '@nestjs/common';
import { Friendship, FriendshipStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FriendshipsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findBetween(a: string, b: string): Promise<Friendship | null> {
    return this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: a, addresseeId: b },
          { requesterId: b, addresseeId: a },
        ],
      },
    });
  }

  findById(id: string): Promise<Friendship | null> {
    return this.prisma.friendship.findUnique({ where: { id } });
  }

  create(requesterId: string, addresseeId: string): Promise<Friendship> {
    return this.prisma.friendship.create({
      data: { requesterId, addresseeId },
    });
  }

  updateStatus(id: string, status: FriendshipStatus): Promise<Friendship> {
    return this.prisma.friendship.update({
      where: { id },
      data: { status, respondedAt: new Date() },
    });
  }

  delete(id: string): Promise<Friendship> {
    return this.prisma.friendship.delete({ where: { id } });
  }

  listForUser(userId: string, status?: FriendshipStatus): Promise<Friendship[]> {
    const where: Prisma.FriendshipWhereInput = {
      OR: [{ requesterId: userId }, { addresseeId: userId }],
      status,
    };
    return this.prisma.friendship.findMany({ where, orderBy: { createdAt: 'desc' } });
  }
}
