import { Injectable } from '@nestjs/common';
import { Business, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BusinessesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByOwnerId(ownerId: string): Promise<Business | null> {
    return this.prisma.business.findFirst({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(id: string): Promise<Business | null> {
    return this.prisma.business.findUnique({ where: { id } });
  }

  findBySlug(slug: string): Promise<Business | null> {
    return this.prisma.business.findUnique({ where: { slug } });
  }

  create(data: Prisma.BusinessCreateInput): Promise<Business> {
    return this.prisma.business.create({ data });
  }

  update(id: string, data: Prisma.BusinessUpdateInput): Promise<Business> {
    return this.prisma.business.update({ where: { id }, data });
  }

  async list(params: {
    skip: number;
    take: number;
    where?: Prisma.BusinessWhereInput;
    orderBy?: Prisma.BusinessOrderByWithRelationInput;
  }): Promise<{ items: Business[]; total: number }> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.business.findMany({
        skip: params.skip,
        take: params.take,
        where: params.where,
        orderBy: params.orderBy ?? { createdAt: 'desc' },
      }),
      this.prisma.business.count({ where: params.where }),
    ]);
    return { items, total };
  }
}
