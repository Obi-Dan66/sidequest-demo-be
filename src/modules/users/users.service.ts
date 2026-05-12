import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PaginatedResult, paginate } from '../../common/responses/api-response';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserDto } from './dto/user.dto';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly users: UsersRepository) {}

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
}
