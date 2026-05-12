import { Injectable, NotFoundException } from '@nestjs/common';
import { QuestCategoryDto } from './dto/quest-category.dto';
import { QuestCategoriesRepository } from './quest-categories.repository';

@Injectable()
export class QuestCategoriesService {
  constructor(private readonly categories: QuestCategoriesRepository) {}

  async listAll(): Promise<QuestCategoryDto[]> {
    const all = await this.categories.listAll();
    return all.map(QuestCategoryDto.fromEntity);
  }

  async getBySlug(slug: string): Promise<QuestCategoryDto> {
    const category = await this.categories.findBySlug(slug);
    if (!category) throw new NotFoundException('Category not found');
    return QuestCategoryDto.fromEntity(category);
  }
}
