import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../../common/auth/auth-user.interface';
import { AppRole } from '../../common/auth/roles.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { IdParamDto } from '../../common/dto/id-param.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  CreateInviteDto,
  InviteCreatedDto,
  InviteListItemDto,
  InviteTokenPreviewDto,
} from './dto/invite.dto';
import { InvitesService } from './invites.service';

@ApiTags('invites')
@Controller({ path: 'invites', version: '1' })
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles(AppRole.USER, AppRole.MODERATOR, AppRole.ADMIN, AppRole.BUSINESS_OWNER)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Send a friend invite by email (stub email transport)' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInviteDto,
  ): Promise<InviteCreatedDto> {
    return this.invitesService.createInvite(user.id, dto.email);
  }

  @Get('me')
  @UseGuards(RolesGuard)
  @Roles(AppRole.USER, AppRole.MODERATOR, AppRole.ADMIN, AppRole.BUSINESS_OWNER)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List invites I have sent' })
  async listMine(@CurrentUser() user: AuthenticatedUser): Promise<InviteListItemDto[]> {
    return this.invitesService.listMine(user.id);
  }

  @Public()
  @Get('preview/:token')
  @ApiOperation({
    summary: 'Public invite preview for signup',
    description: 'Token is the same value as the `invite` query param on the registration URL.',
  })
  async preview(@Param('token') token: string): Promise<InviteTokenPreviewDto> {
    return this.invitesService.previewToken(token);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RolesGuard)
  @Roles(AppRole.USER, AppRole.MODERATOR, AppRole.ADMIN, AppRole.BUSINESS_OWNER)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Cancel a pending invite' })
  async cancel(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto): Promise<void> {
    await this.invitesService.cancel(user.id, params.id);
  }
}
