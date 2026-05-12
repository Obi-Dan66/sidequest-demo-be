import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../../common/auth/auth-user.interface';
import { AppRole } from '../../common/auth/roles.enum';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { IdParamDto } from '../../common/dto/id-param.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateQuestDto } from './dto/create-quest.dto';
import { ListQuestsDto, ListQuestsNearbyDto } from './dto/list-quests.dto';
import { QuestDto } from './dto/quest.dto';
import { QuestsService } from './quests.service';

@ApiTags('quests')
@ApiBearerAuth('access-token')
@Controller({ path: 'quests', version: '1' })
export class QuestsController {
  constructor(private readonly questsService: QuestsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List quests (filterable, paginated)' })
  @ApiPaginatedResponse(QuestDto)
  async list(@Query() query: ListQuestsDto) {
    return this.questsService.list(query);
  }

  @Public()
  @Get('nearby')
  @ApiOperation({ summary: 'List quests near coordinates (radius search)' })
  async listNearby(@Query() query: ListQuestsNearbyDto): Promise<QuestDto[]> {
    return this.questsService.listNearby(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get quest by id' })
  async getById(@Param() params: IdParamDto): Promise<QuestDto> {
    return this.questsService.getById(params.id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(AppRole.ADMIN, AppRole.MODERATOR, AppRole.BUSINESS_OWNER)
  @ApiOperation({ summary: 'Create a new quest (admin/moderator/business owner)' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateQuestDto,
  ): Promise<QuestDto> {
    return this.questsService.create(user.id, dto);
  }

  @Post(':id/start')
  @ApiOperation({ summary: 'Mark a quest as started for the current user' })
  async start(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<{ ok: true }> {
    await this.questsService.start(user.id, params.id);
    return { ok: true };
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Mark a quest as completed for the current user' })
  async complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<{ ok: true }> {
    await this.questsService.complete(user.id, params.id);
    return { ok: true };
  }
}
