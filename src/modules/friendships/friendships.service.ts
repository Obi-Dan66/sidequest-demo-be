import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FriendshipStatus, Prisma, QuestCompletionStatus } from '@prisma/client';
import { ParticipantSummaryDto } from '../../common/dto/participant-summary.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsBus } from '../events/events.bus';
import { AppEvents } from '../events/events.types';
import { FriendActivityDto, FriendActivityKind } from './dto/friend-activity.dto';
import { FriendPresenceStatus, FriendSummaryDto } from './dto/friend-summary.dto';
import { FriendshipDto } from './dto/friendship.dto';
import { PendingFriendshipDto } from './dto/pending-friendship.dto';
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
    this.events.emit(AppEvents.FriendRequestSent, {
      requesterId,
      addresseeId,
      friendshipId: created.id,
    });
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
      friendshipId,
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
   * Accepted friends with presence, current quest, last seen, and mutual completions.
   * One round-trip (single SQL statement with lateral joins).
   */
  async listFriends(userId: string): Promise<FriendSummaryDto[]> {
    type Row = {
      id: string;
      username: string;
      displayName: string | null;
      avatarUrl: string | null;
      level: number;
      xp: number;
      lastSeenAt: Date | null;
      mutualQuestsCount: number;
      currentQuestId: string | null;
      currentQuestTitle: string | null;
      status: string;
    };

    const rows = await this.prisma.$queryRaw<Row[]>(Prisma.sql`
      WITH friends AS (
        SELECT
          CASE WHEN f."requesterId" = ${userId} THEN f."addresseeId" ELSE f."requesterId" END AS friend_id,
          COALESCE(f."respondedAt", f."updatedAt") AS sort_key
        FROM "Friendship" f
        WHERE f."status" = 'ACCEPTED'::"FriendshipStatus"
          AND (f."requesterId" = ${userId} OR f."addresseeId" = ${userId})
      )
      SELECT
        u."id",
        u."username",
        u."displayName",
        u."avatarUrl",
        u."level",
        u."xp",
        u."lastSeenAt",
        COALESCE(mutual.cnt, 0) AS "mutualQuestsCount",
        cq."questId" AS "currentQuestId",
        q."title" AS "currentQuestTitle",
        CASE
          WHEN cq."questId" IS NOT NULL THEN 'QUESTING'
          WHEN u."lastSeenAt" IS NOT NULL AND u."lastSeenAt" > NOW() - INTERVAL '5 minutes' THEN 'ONLINE'
          ELSE 'OFFLINE'
        END AS "status"
      FROM friends fr
      JOIN "User" u ON u."id" = fr.friend_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS cnt
        FROM "QuestCompletion" qc_me
        INNER JOIN "QuestCompletion" qc_f ON qc_me."questId" = qc_f."questId"
          AND qc_f."userId" = fr.friend_id
        WHERE qc_me."userId" = ${userId}
          AND qc_me."status" = 'COMPLETED'::"QuestCompletionStatus"
          AND qc_f."status" = 'COMPLETED'::"QuestCompletionStatus"
      ) mutual ON true
      LEFT JOIN LATERAL (
        SELECT qc."questId"
        FROM "QuestCompletion" qc
        WHERE qc."userId" = fr.friend_id
          AND qc."status" = 'STARTED'::"QuestCompletionStatus"
          AND qc."startedAt" > NOW() - INTERVAL '2 hours'
        ORDER BY qc."startedAt" DESC
        LIMIT 1
      ) cq ON true
      LEFT JOIN "Quest" q ON q."id" = cq."questId"
      ORDER BY fr.sort_key DESC NULLS LAST
    `);

    return rows.map((row) => ({
      id: row.id,
      username: row.username,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      level: row.level,
      xp: row.xp,
      status: parseFriendPresenceStatus(row.status),
      currentQuest:
        row.currentQuestId && row.currentQuestTitle
          ? { id: row.currentQuestId, title: row.currentQuestTitle }
          : null,
      lastSeenAt: row.lastSeenAt,
      mutualQuestsCount: Number(row.mutualQuestsCount),
    }));
  }

  async listPendingIncoming(userId: string): Promise<PendingFriendshipDto[]> {
    const rows = await this.prisma.friendship.findMany({
      where: { addresseeId: userId, status: FriendshipStatus.PENDING },
      include: {
        requester: {
          select: { id: true, username: true, displayName: true, avatarUrl: true, level: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => ({
      id: row.id,
      requester: row.requester,
      createdAt: row.createdAt,
    }));
  }

  async activityFeed(
    userId: string,
    options: { limit: number; cursor?: string },
  ): Promise<{ items: FriendActivityDto[]; nextCursor?: string }> {
    const friendIds = await this.acceptedFriendIds(userId);
    if (friendIds.length === 0) {
      return { items: [] };
    }

    const limit = Math.max(1, Math.min(100, options.limit));
    let before: Date | undefined;
    if (options.cursor !== undefined && options.cursor !== '') {
      const parsed = new Date(options.cursor);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException('cursor must be a valid ISO 8601 timestamp');
      }
      before = parsed;
    }

    const perStream = Math.min(500, Math.max(limit + 60, limit * 12));
    const olderThan = before === undefined ? undefined : { lt: before };

    const userSelect = {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      level: true,
    } satisfies Prisma.UserSelect;

    const [completedQuests, startedQuests, achievements, levelUps, placeVisits] =
      await this.prisma.$transaction([
        this.prisma.questCompletion.findMany({
          where: {
            userId: { in: friendIds },
            status: QuestCompletionStatus.COMPLETED,
            completedAt: olderThan === undefined ? { not: null } : { not: null, ...olderThan },
          },
          orderBy: { completedAt: 'desc' },
          take: perStream,
          include: {
            user: { select: userSelect },
            quest: { select: { id: true, title: true } },
          },
        }),
        this.prisma.questCompletion.findMany({
          where: {
            userId: { in: friendIds },
            status: QuestCompletionStatus.STARTED,
            ...(olderThan === undefined ? {} : { startedAt: olderThan }),
          },
          orderBy: { startedAt: 'desc' },
          take: perStream,
          include: {
            user: { select: userSelect },
            quest: { select: { id: true, title: true } },
          },
        }),
        this.prisma.userAchievement.findMany({
          where: {
            userId: { in: friendIds },
            unlockedAt: olderThan === undefined ? { not: null } : { not: null, ...olderThan },
          },
          orderBy: { unlockedAt: 'desc' },
          take: perStream,
          include: {
            user: { select: userSelect },
            achievement: { select: { id: true, name: true, xpBonus: true } },
          },
        }),
        this.prisma.notification.findMany({
          where: {
            userId: { in: friendIds },
            type: 'LEVEL_UP',
            ...(olderThan === undefined ? {} : { createdAt: olderThan }),
          },
          orderBy: { createdAt: 'desc' },
          take: perStream,
          include: { user: { select: userSelect } },
        }),
        this.prisma.questLocationCheckIn.findMany({
          where: {
            userId: { in: friendIds },
            ...(olderThan === undefined ? {} : { createdAt: olderThan }),
          },
          orderBy: { createdAt: 'desc' },
          take: perStream,
          include: {
            user: { select: userSelect },
            quest: { select: { id: true, title: true } },
            location: { select: { name: true, address: true } },
          },
        }),
      ]);

    type MergeRow = {
      createdAt: Date;
      id: string;
      dto: FriendActivityDto;
    };

    const merged: MergeRow[] = [];

    const participant = (u: {
      id: string;
      username: string;
      displayName: string | null;
      avatarUrl: string | null;
      level: number;
    }): ParticipantSummaryDto => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      level: u.level,
    });

    for (const c of completedQuests) {
      if (!c.completedAt) continue;
      const u = c.user;
      merged.push({
        createdAt: c.completedAt,
        id: c.id,
        dto: {
          id: c.id,
          kind: FriendActivityKind.QuestCompleted,
          userId: u.id,
          user: participant(u),
          questId: c.quest.id,
          questTitle: c.quest.title,
          achievementId: null,
          achievementTitle: null,
          placeName: null,
          xpEarned: c.xpAwarded,
          createdAt: c.completedAt.toISOString(),
        },
      });
    }

    for (const c of startedQuests) {
      const u = c.user;
      merged.push({
        createdAt: c.startedAt,
        id: c.id,
        dto: {
          id: c.id,
          kind: FriendActivityKind.QuestStarted,
          userId: u.id,
          user: participant(u),
          questId: c.quest.id,
          questTitle: c.quest.title,
          achievementId: null,
          achievementTitle: null,
          placeName: null,
          xpEarned: null,
          createdAt: c.startedAt.toISOString(),
        },
      });
    }

    for (const a of achievements) {
      if (!a.unlockedAt) continue;
      const u = a.user;
      merged.push({
        createdAt: a.unlockedAt,
        id: a.id,
        dto: {
          id: a.id,
          kind: FriendActivityKind.AchievementUnlocked,
          userId: u.id,
          user: participant(u),
          questId: null,
          questTitle: null,
          achievementId: a.achievement.id,
          achievementTitle: a.achievement.name,
          placeName: null,
          xpEarned: a.achievement.xpBonus,
          createdAt: a.unlockedAt.toISOString(),
        },
      });
    }

    for (const n of levelUps) {
      const u = n.user;
      merged.push({
        createdAt: n.createdAt,
        id: n.id,
        dto: {
          id: n.id,
          kind: FriendActivityKind.LevelUp,
          userId: u.id,
          user: participant(u),
          questId: null,
          questTitle: null,
          achievementId: null,
          achievementTitle: null,
          placeName: null,
          xpEarned: null,
          createdAt: n.createdAt.toISOString(),
        },
      });
    }

    for (const visit of placeVisits) {
      const u = visit.user;
      const loc = visit.location;
      const placeLabel =
        loc.name !== null && loc.name !== ''
          ? loc.name
          : loc.address !== null && loc.address !== ''
            ? loc.address
            : null;
      merged.push({
        createdAt: visit.createdAt,
        id: visit.id,
        dto: {
          id: visit.id,
          kind: FriendActivityKind.PlaceVisited,
          userId: u.id,
          user: participant(u),
          questId: visit.quest.id,
          questTitle: visit.quest.title,
          achievementId: null,
          achievementTitle: null,
          placeName: placeLabel,
          xpEarned: null,
          createdAt: visit.createdAt.toISOString(),
        },
      });
    }

    merged.sort((a, b) => {
      const t = b.createdAt.getTime() - a.createdAt.getTime();
      if (t !== 0) return t;
      if (a.id < b.id) return 1;
      if (a.id > b.id) return -1;
      return 0;
    });

    const hitCap =
      completedQuests.length >= perStream ||
      startedQuests.length >= perStream ||
      achievements.length >= perStream ||
      levelUps.length >= perStream ||
      placeVisits.length >= perStream;

    const pageRows = merged.slice(0, limit);
    const hasMore = merged.length > limit || (pageRows.length === limit && hitCap);
    const nextCursor =
      hasMore && pageRows.length > 0 ? pageRows[pageRows.length - 1].dto.createdAt : undefined;

    return { items: pageRows.map((r) => r.dto), nextCursor };
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

function parseFriendPresenceStatus(value: string): FriendPresenceStatus {
  if (value === FriendPresenceStatus.QUESTING) return FriendPresenceStatus.QUESTING;
  if (value === FriendPresenceStatus.ONLINE) return FriendPresenceStatus.ONLINE;
  return FriendPresenceStatus.OFFLINE;
}
