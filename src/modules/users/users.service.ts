import { Injectable, NotFoundException } from '@nestjs/common';
import { FriendshipStatus, Prisma, QuestCompletionStatus, User } from '@prisma/client';
import { progressFromXp } from '../../common/gamification/xp';
import { PaginatedResult, paginate } from '../../common/responses/api-response';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserStatsDto } from './dto/user-stats.dto';
import { UserDto } from './dto/user.dto';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly users: UsersRepository,
    private readonly prisma: PrismaService,
  ) {}

  async getById(id: string): Promise<UserDto> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return UserDto.fromEntity(user);
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

  async list(page: number, limit: number, search?: string): Promise<PaginatedResult<UserDto>> {
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
      skip: (page - 1) * limit,
      take: limit,
      where,
    });

    return paginate(items.map(UserDto.fromEntity), page, limit, total);
  }

  async updateProfile(id: string, dto: UpdateUserDto): Promise<UserDto> {
    const user = await this.users.update(id, dto);
    return UserDto.fromEntity(user);
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

  async setAvatarUrl(id: string, avatarUrl: string): Promise<UserDto> {
    const user = await this.users.update(id, { avatarUrl });
    return UserDto.fromEntity(user);
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
      completions: {
        started,
        completed,
        abandoned,
        expired,
      },
      byCategory,
    };
  }
}
