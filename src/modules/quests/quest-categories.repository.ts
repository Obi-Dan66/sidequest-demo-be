import { Injectable } from '@nestjs/common';
import { QuestCategory } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  questCategoryPublishedCountInclude,
  QuestCategoryWithPublishedCount,
} from './quest-category-published.include';

@Injectable()
export class QuestCategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  listAll(): Promise<QuestCategoryWithPublishedCount[]> {
    return this.prisma.questCategory.findMany({
      orderBy: { name: 'asc' },
      include: questCategoryPublishedCountInclude,
    });
  }

  findBySlug(slug: string): Promise<QuestCategoryWithPublishedCount | null> {
    return this.prisma.questCategory.findUnique({
      where: { slug },
      include: questCategoryPublishedCountInclude,
    });
  }

  findById(id: string): Promise<QuestCategory | null> {
    return this.prisma.questCategory.findUnique({ where: { id } });
  }
}
