import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../../common/auth/auth-user.interface';
import { AppRole } from '../../common/auth/roles.enum';
import { ApiPaginatedResponse } from '../../common/decorators/api-paginated-response.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { IdParamDto } from '../../common/dto/id-param.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { BusinessesService } from './businesses.service';
import { BusinessDto } from './dto/business.dto';
import { CreateBusinessDto } from './dto/create-business.dto';

@ApiTags('businesses')
@ApiBearerAuth('access-token')
@Controller({ path: 'businesses', version: '1' })
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List businesses (paginated)' })
  @ApiPaginatedResponse(BusinessDto)
  async list(@Query() query: PaginationQueryDto) {
    return this.businessesService.list(query.page, query.limit, query.search);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get business by id' })
  async getById(@Param() params: IdParamDto): Promise<BusinessDto> {
    return this.businessesService.getById(params.id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(AppRole.BUSINESS_OWNER, AppRole.ADMIN)
  @ApiOperation({ summary: 'Register a new business' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBusinessDto,
  ): Promise<BusinessDto> {
    return this.businessesService.create(user.id, dto);
  }
}
