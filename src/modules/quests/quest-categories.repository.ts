import { Injectable } from '@nestjs/common';
import { QuestCategory } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class QuestCategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  listAll(): Promise<QuestCategory[]> {
    return this.prisma.questCategory.findMany({ orderBy: { name: 'asc' } });
  }

  findBySlug(slug: string): Promise<QuestCategory | null> {
    return this.prisma.questCategory.findUnique({ where: { slug } });
  }

  findById(id: string): Promise<QuestCategory | null> {
    return this.prisma.questCategory.findUnique({ where: { id } });
  }
}
