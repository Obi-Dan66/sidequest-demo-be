import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FriendshipStatus, QuestCompletionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsBus } from '../events/events.bus';
import { AppEvents } from '../events/events.types';
import { UserDto } from '../users/dto/user.dto';
import { ActivityItemDto, ActivityKind } from './dto/activity-item.dto';
import { FriendDto } from './dto/friend.dto';
import { FriendshipDto } from './dto/friendship.dto';
import { FriendshipsRepository } from './friendships.repository';

@Injectable()
export class FriendshipsService {
  constructor(
    private readonly friendships: FriendshipsRepository,
    private readonly events: EventsBus,
    private readonly prisma: PrismaService,
  ) {}

  async request(requesterId: string, addresseeId: string): Promise<FriendshipDto> {
    if (requesterId === addresseeId) {
      throw new BadRequestException('Cannot send a friend request to yourself');
    }
    const existing = await this.friendships.findBetween(requesterId, addresseeId);
    if (existing) throw new ConflictException('Friendship already exists');

    const created = await this.friendships.create(requesterId, addresseeId);
    this.events.emit(AppEvents.FriendRequestSent, { requesterId, addresseeId });
    return FriendshipDto.fromEntity(created);
  }

  async accept(userId: string, friendshipId: string): Promise<FriendshipDto> {
    const f = await this.friendships.findById(friendshipId);
    if (!f) throw new NotFoundException('Friendship not found');
    if (f.addresseeId !== userId) throw new ForbiddenException('Only the addressee can accept');
    if (f.status !== FriendshipStatus.PENDING) {
      throw new BadRequestException('Friendship is not pending');
    }
    const updated = await this.friendships.updateStatus(friendshipId, FriendshipStatus.ACCEPTED);
    this.events.emit(AppEvents.FriendRequestAccepted, {
      requesterId: f.requesterId,
      addresseeId: f.addresseeId,
    });
    return FriendshipDto.fromEntity(updated);
  }

  async block(userId: string, otherUserId: string): Promise<FriendshipDto> {
    let f = await this.friendships.findBetween(userId, otherUserId);
    if (!f) {
      f = await this.friendships.create(userId, otherUserId);
    }
    const updated = await this.friendships.updateStatus(f.id, FriendshipStatus.BLOCKED);
    return FriendshipDto.fromEntity(updated);
  }

  async remove(userId: string, friendshipId: string): Promise<void> {
    const f = await this.friendships.findById(friendshipId);
    if (!f) throw new NotFoundException('Friendship not found');
    if (f.requesterId !== userId && f.addresseeId !== userId) {
      throw new ForbiddenException('Not allowed');
    }
    await this.friendships.delete(friendshipId);
  }

  async listMine(userId: string, status?: FriendshipStatus): Promise<FriendshipDto[]> {
    const all = await this.friendships.listForUser(userId, status);
    return all.map(FriendshipDto.fromEntity);
  }

  /**
   * Resolved friend list: returns the friend's user record (not the friendship row),
   * with the relationship direction relative to the viewer.
   */
  async listFriends(userId: string): Promise<FriendDto[]> {
    const rows = await this.prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      include: { requester: true, addressee: true },
      orderBy: { respondedAt: 'desc' },
    });

    return rows.map((row) => {
      const otherUser = row.requesterId === userId ? row.addressee : row.requester;
      const direction = row.requesterId === userId ? 'outgoing' : 'incoming';
      return {
        friendshipId: row.id,
        status: row.status,
        user: UserDto.fromEntity(otherUser),
        since: row.respondedAt ?? row.updatedAt,
        direction,
      };
    });
  }

  async listPendingIncoming(userId: string): Promise<FriendDto[]> {
    const rows = await this.prisma.friendship.findMany({
      where: { addresseeId: userId, status: FriendshipStatus.PENDING },
      include: { requester: true },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => ({
      friendshipId: row.id,
      status: row.status,
      user: UserDto.fromEntity(row.requester),
      since: row.createdAt,
      direction: 'incoming',
    }));
  }

  /**
   * Activity feed: the most recent quest completions and achievement unlocks of
   * the viewer's accepted friends. Derived (no `Activity` table) -> sufficient for MVP.
   */
  async activityFeed(userId: string, limit = 30): Promise<ActivityItemDto[]> {
    const friendIds = await this.acceptedFriendIds(userId);
    if (friendIds.length === 0) return [];

    const cap = Math.max(1, Math.min(100, limit));

    const [completions, achievements] = await this.prisma.$transaction([
      this.prisma.questCompletion.findMany({
        where: { userId: { in: friendIds }, status: QuestCompletionStatus.COMPLETED },
        orderBy: { completedAt: 'desc' },
        take: cap,
        include: {
          user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          quest: { select: { id: true, slug: true, title: true, imageUrl: true } },
        },
      }),
      this.prisma.userAchievement.findMany({
        where: { userId: { in: friendIds } },
        orderBy: { unlockedAt: 'desc' },
        take: cap,
        include: {
          user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          achievement: { select: { id: true, slug: true, name: true, iconUrl: true } },
        },
      }),
    ]);

    const items: ActivityItemDto[] = [];

    for (const c of completions) {
      if (!c.completedAt) continue;
      items.push({
        kind: ActivityKind.QuestCompleted,
        at: c.completedAt,
        actor: c.user,
        quest: {
          id: c.quest.id,
          slug: c.quest.slug,
          title: c.quest.title,
          imageUrl: c.quest.imageUrl,
          xpAwarded: c.xpAwarded,
        },
      });
    }
    for (const a of achievements) {
      items.push({
        kind: ActivityKind.AchievementUnlocked,
        at: a.unlockedAt,
        actor: a.user,
        achievement: {
          id: a.achievement.id,
          slug: a.achievement.slug,
          name: a.achievement.name,
          iconUrl: a.achievement.iconUrl,
        },
      });
    }

    items.sort((a, b) => b.at.getTime() - a.at.getTime());
    return items.slice(0, cap);
  }

  private async acceptedFriendIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      select: { requesterId: true, addresseeId: true },
    });
    const ids = new Set<string>();
    for (const r of rows) {
      ids.add(r.requesterId === userId ? r.addresseeId : r.requesterId);
    }
    return Array.from(ids);
  }
}
