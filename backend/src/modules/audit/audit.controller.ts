import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AccessModule } from '../../common/decorators/access-module.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import type { AuthenticatedUser } from '../../shared/types/authenticated-user';
import { AuditService } from './audit.service';
import { PlaybackEventsQueryDto } from './dto/playback-events-query.dto';

@ApiTags('audit')
@ApiCookieAuth('cookie')
@Controller('audit')
@AccessModule('admin.history')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('playback-events')
  @Permissions('history:read')
  playbackEvents(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PlaybackEventsQueryDto,
  ) {
    return this.auditService.playbackEvents(user, query);
  }
}
