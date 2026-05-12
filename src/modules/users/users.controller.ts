import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/auth-user.interface';
import { IdParamDto } from '../../common/dto/id-param.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserDto } from './dto/user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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

  @Get()
  @ApiOperation({ summary: 'List users (paginated)' })
  @ApiPaginatedResponse(UserDto)
  async list(@Query() query: PaginationQueryDto) {
    return this.usersService.list(query.page, query.limit, query.search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by id' })
  async getById(@Param() params: IdParamDto): Promise<UserDto> {
    return this.usersService.getById(params.id);
  }
}
