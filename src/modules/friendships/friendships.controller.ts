import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { FriendshipStatus } from '@prisma/client';
import { AuthenticatedUser } from '../../common/auth/auth-user.interface';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IdParamDto } from '../../common/dto/id-param.dto';
import { ActivityItemDto } from './dto/activity-item.dto';
import { CreateFriendshipDto } from './dto/create-friendship.dto';
import { FriendDto } from './dto/friend.dto';
import { FriendshipDto } from './dto/friendship.dto';
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
  @ApiOperation({ summary: 'List accepted friends as resolved users' })
  async listFriends(@CurrentUser() user: AuthenticatedUser): Promise<FriendDto[]> {
    return this.friendshipsService.listFriends(user.id);
  }

  @Get('pending')
  @ApiOperation({ summary: 'List pending incoming friend requests' })
  async listPending(@CurrentUser() user: AuthenticatedUser): Promise<FriendDto[]> {
    return this.friendshipsService.listPendingIncoming(user.id);
  }

  @Get('activity')
  @ApiOperation({ summary: 'Recent activity from my friends (quest completions + achievements)' })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 100 },
  })
  async activity(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
  ): Promise<ActivityItemDto[]> {
    let resolved = 30;
    if (limit) {
      const parsed = Number.parseInt(limit, 10);
      if (Number.isFinite(parsed) && parsed > 0) resolved = parsed;
    }
    return this.friendshipsService.activityFeed(user.id, resolved);
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
