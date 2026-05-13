import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FriendshipStatus, Prisma, QuestCompletionStatus, User } from '@prisma/client';
import { buildPersonalRegisterRefLink } from '../../common/invite/build-register-links.util';
import { progressFromXp } from '../../common/gamification/xp';
import { PaginatedResult, paginate } from '../../common/responses/api-response';
import { PrismaService } from '../../prisma/prisma.service';
import { QuestCompletionsRepository } from '../quests/quest-completions.repository';
import { ListUsersQueryDto, UserListSort } from './dto/list-users-query.dto';
import { QuestHistoryItemDto } from './dto/quest-history.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserStatsDto } from './dto/user-stats.dto';
import { UserDto } from './dto/user.dto';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly users: UsersRepository,
    private readonly prisma: PrismaService,
    private readonly questCompletions: QuestCompletionsRepository,
    private readonly config: ConfigService,
  ) {}

  async getById(id: string): Promise<UserDto> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return this.toUserDto(user);
  }

  async findRawById(id: string): Promise<User | null> {
    return this.users.findById(id);
  }

  async findRawByEmail(email: string): Promise<User | null> {
    return this.users.findByEmail(email);
  }

  async findRawByUsername(username: string): Promise<User | null> {
    return this.users.findByUsername(username);
  }

  async list(query: ListUsersQueryDto): Promise<PaginatedResult<UserDto>> {
    const page = query.page;
    const limit = query.limit;
    const search = query.search;
    const sort = query.sort ?? UserListSort.CREATED_DESC;

    const where: Prisma.UserWhereInput | undefined = search
      ? {
          OR: [
            { username: { contains: search, mode: 'insensitive' } },
            { displayName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }
      : undefined;

    const { items, total } = await this.users.list({
      skip: query.skip,
      take: query.take,
      where,
      orderBy: userListOrderBy(sort),
    });

    return paginate(
      items.map((u) => this.toUserDto(u)),
      page,
      limit,
      total,
    );
  }

  async updateProfile(id: string, dto: UpdateUserDto): Promise<UserDto> {
    const user = await this.users.update(id, dto);
    return this.toUserDto(user);
  }

  async updateRefreshTokenHash(id: string, hash: string | null): Promise<void> {
    await this.users.update(id, { refreshTokenHash: hash });
  }

  async recordLogin(id: string): Promise<void> {
    await this.users.update(id, { lastLoginAt: new Date() });
  }

  async createWithCredentials(input: {
    email: string;
    username: string;
    passwordHash: string;
    displayName?: string;
  }): Promise<User> {
    return this.users.create({
      email: input.email,
      username: input.username,
      passwordHash: input.passwordHash,
      displayName: input.displayName,
    });
  }

  async createWithCredentialsTx(
    tx: Prisma.TransactionClient,
    input: {
      email: string;
      username: string;
      passwordHash: string;
      displayName?: string;
    },
  ): Promise<User> {
    return this.users.createWithTx(tx, {
      email: input.email,
      username: input.username,
      passwordHash: input.passwordHash,
      displayName: input.displayName,
    });
  }

  async setAvatarUrl(id: string, avatarUrl: string): Promise<UserDto> {
    const user = await this.users.update(id, { avatarUrl });
    return this.toUserDto(user);
  }

  async getStats(userId: string): Promise<UserStatsDto> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const progress = progressFromXp(user.xp);

    const [
      started,
      completed,
      abandoned,
      expired,
      achievementsUnlocked,
      friendsCount,
      byCategoryRaw,
    ] = await this.prisma.$transaction([
      this.prisma.questCompletion.count({
        where: { userId, status: QuestCompletionStatus.STARTED },
      }),
      this.prisma.questCompletion.count({
        where: { userId, status: QuestCompletionStatus.COMPLETED },
      }),
      this.prisma.questCompletion.count({
        where: { userId, status: QuestCompletionStatus.ABANDONED },
      }),
      this.prisma.questCompletion.count({
        where: { userId, status: QuestCompletionStatus.EXPIRED },
      }),
      this.prisma.userAchievement.count({ where: { userId } }),
      this.prisma.friendship.count({
        where: {
          status: FriendshipStatus.ACCEPTED,
          OR: [{ requesterId: userId }, { addresseeId: userId }],
        },
      }),
      this.prisma.questCompletion.findMany({
        where: { userId, status: QuestCompletionStatus.COMPLETED },
        select: {
          quest: {
            select: {
              category: { select: { slug: true, name: true } },
            },
          },
        },
      }),
    ]);

    const counters = new Map<string, { slug: string; name: string; completed: number }>();
    for (const row of byCategoryRaw) {
      const category = row.quest.category;
      if (!category) continue;
      const current = counters.get(category.slug);
      if (current) {
        current.completed += 1;
      } else {
        counters.set(category.slug, {
          slug: category.slug,
          name: category.name,
          completed: 1,
        });
      }
    }

    const byCategory = Array.from(counters.values())
      .sort((a, b) => b.completed - a.completed)
      .map((c) => ({
        categorySlug: c.slug,
        categoryName: c.name,
        completed: c.completed,
      }));

    return {
      userId: user.id,
      level: progress.level,
      currentXp: progress.currentXp,
      xpForCurrentLevel: progress.xpForCurrentLevel,
      xpForNextLevel: progress.xpForNextLevel,
      xpIntoLevel: progress.xpIntoLevel,
      xpToNextLevel: progress.xpToNextLevel,
      progressRatio: progress.progressRatio,
      questsDone: user.questsDone,
      achievementsUnlocked,
      friendsCount,
      streakDays: user.streakDays,
      longestStreakDays: user.longestStreakDays,
      placesVisited: user.placesVisited,
      distanceWalkedKm: Math.round((user.distanceWalkedM / 1000) * 100) / 100,
      completions: {
        started,
        completed,
        abandoned,
        expired,
      },
      byCategory,
    };
  }

  async getQuestHistory(
    userId: string,
    page: number,
    limit: number,
    status?: QuestCompletionStatus,
  ): Promise<PaginatedResult<QuestHistoryItemDto>> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const effectiveStatus = status ?? QuestCompletionStatus.COMPLETED;

    const { items, total } = await this.questCompletions.listForUser({
      userId,
      status: effectiveStatus,
      skip: (page - 1) * limit,
      take: limit,
    });

    const dtos: QuestHistoryItemDto[] = items.map((row) => ({
      id: row.id,
      questId: row.questId,
      quest: {
        id: row.quest.id,
        slug: row.quest.slug,
        title: row.quest.title,
        coverImageUrl: row.quest.coverImageUrl,
      },
      status: row.status,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      xpEarned: row.xpAwarded,
      durationMinutes: row.durationMin,
    }));

    return paginate(dtos, page, limit, total);
  }

  private toUserDto(user: User): UserDto {
    const base = this.config.get<string>('app.frontendUrl') ?? 'http://localhost:5173';
    const inviteLink = buildPersonalRegisterRefLink(base, user.username);
    return UserDto.fromEntity(user, { inviteLink });
  }
}

function userListOrderBy(sort: UserListSort): Prisma.UserOrderByWithRelationInput[] {
  switch (sort) {
    case UserListSort.XP_DESC:
      return [{ xp: 'desc' }, { id: 'asc' }];
    case UserListSort.XP_ASC:
      return [{ xp: 'asc' }, { id: 'asc' }];
    case UserListSort.LEVEL_DESC:
      return [{ level: 'desc' }, { id: 'asc' }];
    case UserListSort.USERNAME_ASC:
      return [{ username: 'asc' }, { id: 'asc' }];
    case UserListSort.CREATED_DESC:
      return [{ createdAt: 'desc' }, { id: 'asc' }];
  }
}
