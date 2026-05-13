import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { FriendshipStatus } from '@prisma/client';
import { AuthenticatedUser } from '../../common/auth/auth-user.interface';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IdParamDto } from '../../common/dto/id-param.dto';
import { ApiSuccessResponse } from '../../common/responses/api-response';
import { FriendActivityDto } from './dto/friend-activity.dto';
import { FriendshipActivityQueryDto } from './dto/friendship-activity-query.dto';
import { CreateFriendshipDto } from './dto/create-friendship.dto';
import { FriendSummaryDto } from './dto/friend-summary.dto';
import { FriendshipDto } from './dto/friendship.dto';
import { PendingFriendshipDto } from './dto/pending-friendship.dto';
import { FriendshipsService } from './friendships.service';

@ApiTags('friendships')
@ApiBearerAuth('access-token')
@Controller({ path: 'friendships', version: '1' })
export class FriendshipsController {
  constructor(private readonly friendshipsService: FriendshipsService) {}

  @Get()
  @ApiOperation({ summary: 'List my friendships (filterable by status)' })
  @ApiQuery({ name: 'status', enum: FriendshipStatus, required: false })
  async listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: FriendshipStatus,
  ): Promise<FriendshipDto[]> {
    return this.friendshipsService.listMine(user.id, status);
  }

  @Get('friends')
  @ApiOperation({ summary: 'List accepted friends with presence and mutual quest count' })
  async listFriends(@CurrentUser() user: AuthenticatedUser): Promise<FriendSummaryDto[]> {
    return this.friendshipsService.listFriends(user.id);
  }

  @Get('pending')
  @ApiOperation({ summary: 'List pending incoming friend requests with requester details' })
  async listPending(@CurrentUser() user: AuthenticatedUser): Promise<PendingFriendshipDto[]> {
    return this.friendshipsService.listPendingIncoming(user.id);
  }

  @Get('activity')
  @ApiOperation({
    summary:
      'Friend activity feed (quest completions, starts, achievements, level-ups, place visits); pass meta.nextCursor as cursor for the next page',
  })
  async activity(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FriendshipActivityQueryDto,
  ): Promise<ApiSuccessResponse<FriendActivityDto[]>> {
    const limit = query.limit ?? 20;
    const { items, nextCursor } = await this.friendshipsService.activityFeed(user.id, {
      limit,
      cursor: query.cursor,
    });
    return {
      success: true,
      data: items,
      ...(nextCursor !== undefined ? { meta: { nextCursor } } : {}),
    };
  }

  @Post()
  @ApiOperation({ summary: 'Send a friend request' })
  async request(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFriendshipDto,
  ): Promise<FriendshipDto> {
    return this.friendshipsService.request(user.id, dto.addresseeId);
  }

  @Post(':id/accept')
  @ApiOperation({ summary: 'Accept a pending friend request' })
  async accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<FriendshipDto> {
    return this.friendshipsService.accept(user.id, params.id);
  }

  @Post('block/:userId')
  @ApiOperation({ summary: 'Block another user' })
  async block(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') otherUserId: string,
  ): Promise<FriendshipDto> {
    return this.friendshipsService.block(user.id, otherUserId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a friendship' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: IdParamDto,
  ): Promise<{ ok: true }> {
    await this.friendshipsService.remove(user.id, params.id);
    return { ok: true };
  }
}
