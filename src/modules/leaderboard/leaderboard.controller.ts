import { Controller, Get, Header, Headers, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from '../auth/auth.service';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';
import { LeaderboardResponseDto } from './dto/leaderboard-response.dto';
import { LeaderboardService } from './leaderboard.service';

@ApiTags('leaderboard')
@Controller({ path: 'leaderboard', version: '1' })
export class LeaderboardController {
  constructor(
    private readonly leaderboardService: LeaderboardService,
    private readonly authService: AuthService,
  ) {}

  @Public()
  @Get()
  @Header('Cache-Control', 'public, max-age=30')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Explorer leaderboard',
    description:
      'Public. Optional `Authorization: Bearer` adds `myEntry` and sets `isMe` on rows. MONTH/WEEK XP sums completed quest XP in that period.',
  })
  async get(
    @Query() query: LeaderboardQueryDto,
    @Headers('authorization') authorization?: string,
  ): Promise<LeaderboardResponseDto> {
    const viewerId = await this.authService.tryResolveViewerUserId(authorization);
    return this.leaderboardService.get(query, viewerId);
  }
}
