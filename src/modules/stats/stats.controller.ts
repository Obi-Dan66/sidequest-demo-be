import { Controller, Get, Header } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PublicStatsDto } from './dto/public-stats.dto';
import { StatsService } from './stats.service';

@ApiTags('stats')
@Controller({ path: 'stats', version: '1' })
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Public()
  @Get('public')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOperation({
    summary: 'Public landing / social-proof counters',
    description:
      'Cached ~5 minutes in-process. featuredQuest prefers Quest.featuredAt, else best-rated published, else newest published.',
  })
  async getPublic(): Promise<PublicStatsDto> {
    return this.statsService.getPublicStats();
  }
}
