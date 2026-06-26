import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../shared/types/authenticated-user';
import { MailService } from './mail.service';
import { UpdateMailSettingsDto } from './dto/update-mail-settings.dto';
import { SendTestMailDto } from './dto/send-test-mail.dto';
import { SendTemplatePreviewDto } from './dto/send-template-preview.dto';
import { UpsertMailTemplateDto } from './dto/upsert-mail-template.dto';
import { UpdateMailEventDto } from './dto/update-mail-event.dto';
import { CreateMailQueueItemDto } from './dto/create-mail-queue-item.dto';

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
    return this.mailService.testMail(user, dto.to, dto.subject, dto.message);
  }

  @Post('templates/test')
  testTemplate(@CurrentUser() user: AuthenticatedUser, @Body() dto: SendTemplatePreviewDto) {
    this.ensureOwner(user);
    return this.mailService.sendTemplatePreview(user, dto);
  }

  @Get('templates')
  listTemplates(@CurrentUser() user: AuthenticatedUser) {
    this.ensureOwner(user);
    return this.mailService.listTemplates();
  }

  @Post('templates')
  upsertTemplate(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpsertMailTemplateDto) {
    this.ensureOwner(user);
    return this.mailService.upsertTemplate(user, dto);
  }

  @Put('templates/:key')
  updateTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
    @Body() dto: UpsertMailTemplateDto,
  ) {
    this.ensureOwner(user);
    return this.mailService.upsertTemplate(user, { ...dto, key });
  }

  @Delete('templates/:key')
  deleteTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
  ) {
    this.ensureOwner(user);
    return this.mailService.deleteTemplate(key);
  }

  @Post('templates/fix')
  repairTemplates(@CurrentUser() user: AuthenticatedUser) {
    this.ensureOwner(user);
    return this.mailService.repairTemplates(user);
  }

  @Get('variables')
  listVariables(@CurrentUser() user: AuthenticatedUser) {
    this.ensureOwner(user);
    return this.mailService.getVariableCatalog();
  }

  @Get('events')
  listEvents(@CurrentUser() user: AuthenticatedUser) {
    this.ensureOwner(user);
    return this.mailService.listEvents();
  }

  @Put('events/:key')
  updateEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
    @Body() dto: UpdateMailEventDto,
  ) {
    this.ensureOwner(user);
    return this.mailService.updateEvent(user, key, dto);
  }

  @Get('queue')
  listQueue(@CurrentUser() user: AuthenticatedUser) {
    this.ensureOwner(user);
    return this.mailService.listQueue();
  }

  @Post('queue')
  enqueueQueue(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateMailQueueItemDto) {
    this.ensureOwner(user);
    return this.mailService.enqueueMail(user, dto);
  }

  @Post('queue/:id/retry')
  retryQueue(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    this.ensureOwner(user);
    return this.mailService.retryQueueItem(user, id);
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
