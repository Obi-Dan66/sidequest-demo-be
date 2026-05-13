import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthenticatedUser } from '../../common/auth/auth-user.interface';
import { AppRole } from '../../common/auth/roles.enum';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { IdParamDto } from '../../common/dto/id-param.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthService } from '../auth/auth.service';
import { CreateQuestDto } from './dto/create-quest.dto';
import { ListQuestsDto, ListQuestsNearbyDto } from './dto/list-quests.dto';
import { QuestCheckInBodyDto } from './dto/quest-check-in.dto';
import { QuestDto } from './dto/quest.dto';
import { RateQuestDto } from './dto/rate-quest.dto';
import { UpdateQuestDto } from './dto/update-quest.dto';
import { QuestsService } from './quests.service';

@ApiTags('quests')
@ApiBearerAuth('access-token')
@Controller({ path: 'quests', version: '1' })
export class QuestsController {
  constructor(
    private readonly questsService: QuestsService,
    private readonly authService: AuthService,
  ) {}

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
  async getById(
    @Param() params: IdParamDto,
    @Headers('authorization') authorization?: string,
  ): Promise<QuestDto> {
    const viewerId = await this.authService.tryResolveViewerUserId(authorization);
    return this.questsService.getById(params.id, viewerId);
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

  @Patch(':id')
  @ApiOperation({ summary: 'Update a quest (author or admin/moderator only)' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() dto: UpdateQuestDto,
  ): Promise<QuestDto> {
    return this.questsService.update({ id: user.id, role: user.role }, params.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a quest (author or admin/moderator only)' })
  async delete(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto): Promise<void> {
    await this.questsService.delete({ id: user.id, role: user.role }, params.id);
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

  @Post(':id/locations/:locationId/check-in')
  @ApiOperation({ summary: 'Check in at a quest waypoint (geolocation)' })
  async checkInAtLocation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') questId: string,
    @Param('locationId') locationId: string,
    @Body() dto: QuestCheckInBodyDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ stepCompleted: boolean; questCompleted: boolean }> {
    const outcome = await this.questsService.checkInLocation(user.id, questId, locationId, dto);
    res.status(outcome.httpStatus);
    return { stepCompleted: outcome.stepCompleted, questCompleted: outcome.questCompleted };
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Mark a quest as completed for the current user' })
  async complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<{
    ok: true;
    xpAwarded: number;
    leveledUp: boolean;
    newLevel: number;
    streakDays: number;
  }> {
    const outcome = await this.questsService.complete(user.id, params.id);
    return { ok: true, ...outcome };
  }

  @Post(':id/rate')
  @ApiOperation({ summary: 'Rate a quest (upserts)' })
  async rate(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() dto: RateQuestDto,
  ): Promise<{ ok: true }> {
    await this.questsService.rate(user.id, params.id, dto);
    return { ok: true };
  }

  @Delete(':id/rate')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove your rating from a quest' })
  async unrate(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto): Promise<void> {
    await this.questsService.unrate(user.id, params.id);
  }
}
