import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import type { AuthenticatedUser } from '../../shared/types/authenticated-user';
import { RecentPlaybackEventsQueryDto } from './dto/recent-playback-events-query.dto';
import { StartPlaybackEventDto } from './dto/start-playback-event.dto';
import { StopPlaybackEventDto } from './dto/stop-playback-event.dto';
import { PlaybackService } from './playback.service';

@ApiTags('playback-events')
@ApiCookieAuth('cookie')
@Controller('playback-events')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PlaybackController {
  constructor(private readonly playbackService: PlaybackService) {}

  @Get('recent')
  @Permissions('board:use')
  recent(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RecentPlaybackEventsQueryDto,
  ) {
    return this.playbackService.recent(user, query);
  }

  @Post('start')
  @Permissions('board:use')
  start(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StartPlaybackEventDto,
  ) {
    return this.playbackService.start(user, dto);
  }

  @Patch(':id/stop')
  @Permissions('board:use')
  stop(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: StopPlaybackEventDto,
  ) {
    return this.playbackService.stop(user, id, dto);
  }
}
