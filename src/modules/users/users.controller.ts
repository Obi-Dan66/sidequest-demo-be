import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../../common/auth/auth-user.interface';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IdParamDto } from '../../common/dto/id-param.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UploadResponseDto } from '../uploads/dto/upload-response.dto';
import { UploadsService } from '../uploads/uploads.service';
import { QuestHistoryItemDto, QuestHistoryQueryDto } from './dto/quest-history.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserStatsDto } from './dto/user-stats.dto';
import { UserDto } from './dto/user.dto';
import { UsersService } from './users.service';

interface UploadedFileLike {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

function isUploadedFile(value: unknown): value is UploadedFileLike {
  if (typeof value !== 'object' || value === null) return false;
  const buffer = Reflect.get(value, 'buffer');
  const originalname = Reflect.get(value, 'originalname');
  const mimetype = Reflect.get(value, 'mimetype');
  return (
    Buffer.isBuffer(buffer) && typeof originalname === 'string' && typeof mimetype === 'string'
  );
}

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly uploadsService: UploadsService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user' })
  async getMe(@CurrentUser() user: AuthenticatedUser): Promise<UserDto> {
    return this.usersService.getById(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current authenticated user profile' })
  async updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateUserDto,
  ): Promise<UserDto> {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Get('me/stats')
  @ApiOperation({ summary: 'Get gamification stats for the current user' })
  async getMyStats(@CurrentUser() user: AuthenticatedUser): Promise<UserStatsDto> {
    return this.usersService.getStats(user.id);
  }

  @Get('me/quests/history')
  @ApiOperation({ summary: 'List quest history for the current user' })
  @ApiPaginatedResponse(QuestHistoryItemDto)
  async getMyQuestHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QuestHistoryQueryDto,
  ) {
    return this.usersService.getQuestHistory(user.id, query.page, query.limit, query.status);
  }

  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Upload (or replace) the current user avatar' })
  async uploadAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: unknown,
  ): Promise<UploadResponseDto & { user: UserDto }> {
    if (!isUploadedFile(file)) throw new BadRequestException('No file uploaded');

    const stored = await this.uploadsService.upload({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
    });
    const updated = await this.usersService.setAvatarUrl(user.id, stored.url);

    return {
      filename: stored.filename,
      url: stored.url,
      sizeBytes: stored.sizeBytes,
      mimeType: stored.mimeType,
      user: updated,
    };
  }

  @Get()
  @ApiOperation({ summary: 'List users (paginated)' })
  @ApiPaginatedResponse(UserDto)
  async list(@Query() query: ListUsersQueryDto) {
    return this.usersService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by id' })
  async getById(@Param() params: IdParamDto): Promise<UserDto> {
    return this.usersService.getById(params.id);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get public gamification stats for a user' })
  async getStats(@Param() params: IdParamDto): Promise<UserStatsDto> {
    return this.usersService.getStats(params.id);
  }

  @Get(':id/quests/history')
  @ApiOperation({ summary: 'List quest history for a user (public stats)' })
  @ApiPaginatedResponse(QuestHistoryItemDto)
  async getUserQuestHistory(@Param() params: IdParamDto, @Query() query: QuestHistoryQueryDto) {
    return this.usersService.getQuestHistory(params.id, query.page, query.limit, query.status);
  }
}
