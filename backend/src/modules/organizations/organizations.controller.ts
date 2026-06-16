import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import type { AuthenticatedUser } from '../../shared/types/authenticated-user';
import { MailService } from '../mail/mail.service';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class CreateInviteDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  role!: string;
}

@ApiTags('organizations')
@ApiCookieAuth('cookie')
@Controller('organizations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly mailService: MailService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.list(user);
  }

  @Get('current')
  @Permissions('organization:read')
  current(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.current(user);
  }

  @Post()
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        status: { type: 'string', enum: ['ACTIVE', 'DISABLED'] },
      },
      required: ['name'],
    },
  })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateOrganizationDto) {
    return this.organizationsService.create(user, dto);
  }

  @Patch(':id')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        status: { type: 'string', enum: ['ACTIVE', 'DISABLED'] },
      },
    },
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.update(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.organizationsService.remove(user, id);
  }

  @Get(':id/narrative-integrity')
  narrativeIntegrity(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.organizationsService.narrativeIntegrity(user, id);
  }

  @Post(':id/invites')
  @Permissions('user:create')
  createInvite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateInviteDto,
  ) {
    return this.mailService.createInvite(user, id, dto);
  }

  @Post(':id/invites/:inviteId/resend')
  @Permissions('user:create')
  resendInvite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('inviteId') inviteId: string,
  ) {
    return this.mailService.resendInvite(user, id, inviteId);
  }

  @Post(':id/invites/:inviteId/approve')
  @Permissions('user:update')
  approveInvite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('inviteId') inviteId: string,
  ) {
    return this.mailService.approveInvite(user, id, inviteId);
  }
}
