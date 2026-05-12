import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { QuestCategoryDto } from './dto/quest-category.dto';
import { QuestCategoriesService } from './quest-categories.service';

@ApiTags('quests')
@Controller({ path: 'quest-categories', version: '1' })
export class QuestCategoriesController {
  constructor(private readonly categoriesService: QuestCategoriesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all quest categories' })
  async list(): Promise<QuestCategoryDto[]> {
    return this.categoriesService.listAll();
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get a quest category by slug' })
  async getBySlug(@Param('slug') slug: string): Promise<QuestCategoryDto> {
    return this.categoriesService.getBySlug(slug);
  }
}
