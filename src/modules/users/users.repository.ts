import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Thin Prisma-backed repository. Repositories own raw persistence concerns;
 * services compose multiple repositories + business logic.
 */
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { username } });
  }

  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  async list(params: {
    skip: number;
    take: number;
    where?: Prisma.UserWhereInput;
    orderBy?: Prisma.UserOrderByWithRelationInput;
  }): Promise<{ items: User[]; total: number }> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        skip: params.skip,
        take: params.take,
        where: params.where,
        orderBy: params.orderBy ?? { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where: params.where }),
    ]);
    return { items, total };
  }

  delete(id: string): Promise<User> {
    return this.prisma.user.delete({ where: { id } });
  }
}
