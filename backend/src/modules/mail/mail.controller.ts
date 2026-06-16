import { Body, Controller, ForbiddenException, Get, Post, Put, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../shared/types/authenticated-user';
import { MailService } from './mail.service';
import { UpdateMailSettingsDto } from './dto/update-mail-settings.dto';
import { SendTestMailDto } from './dto/send-test-mail.dto';

@ApiTags('mail')
@ApiCookieAuth('cookie')
@Controller('admin/mail')
@UseGuards(JwtAuthGuard)
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Get('settings')
  getSettings(@CurrentUser() user: AuthenticatedUser) {
    this.ensureOwner(user);
    return this.mailService.getSettings();
  }

  @Put('settings')
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateMailSettingsDto,
  ) {
    this.ensureOwner(user);
    return this.mailService.updateSettings(user, dto);
  }

  @Post('test')
  testMail(@CurrentUser() user: AuthenticatedUser, @Body() dto: SendTestMailDto) {
    this.ensureOwner(user);
    return this.mailService.testMail(user, dto.to, dto.subject);
  }

  @Get('logs')
  listLogs(@CurrentUser() user: AuthenticatedUser) {
    this.ensureOwner(user);
    return this.mailService.listLogs();
  }

  @Get('invites')
  listInvites(@CurrentUser() user: AuthenticatedUser) {
    this.ensureOwner(user);
    return this.mailService.listAllOrganizationInvites();
  }

  private ensureOwner(user: AuthenticatedUser) {
    if (user.role !== 'OWNER') {
      throw new ForbiddenException('Only OWNER can manage mail settings');
    }
  }
}
