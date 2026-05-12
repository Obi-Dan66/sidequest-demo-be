import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../../common/auth/auth-user.interface';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AchievementsService } from './achievements.service';
import { AchievementDto, UserAchievementDto } from './dto/achievement.dto';

@ApiTags('achievements')
@ApiBearerAuth('access-token')
@Controller({ path: 'achievements', version: '1' })
export class AchievementsController {
  constructor(private readonly achievementsService: AchievementsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all achievement definitions' })
  async listAll(): Promise<AchievementDto[]> {
    return this.achievementsService.listAll();
  }

  @Get('me')
  @ApiOperation({ summary: 'List achievements unlocked by the current user' })
  async listMine(@CurrentUser() user: AuthenticatedUser): Promise<UserAchievementDto[]> {
    return this.achievementsService.listForUser(user.id);
  }
}
