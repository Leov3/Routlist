import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AccessModule } from '../../common/decorators/access-module.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import type { AuthenticatedUser } from '../../shared/types/authenticated-user';
import { CreateRunEventDto } from './dto/create-run-event.dto';
import { GenerateDynamicAudioDto } from './dto/generate-dynamic-audio.dto';
import { UpdateCurrentNodeDto } from './dto/update-current-node.dto';
import { NarrativeRunsService } from './narrative-runs.service';

@ApiTags('narrative-runs')
@ApiCookieAuth('cookie')
@Controller('narrative-runs')
@AccessModule('admin.narratives')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class NarrativeRunsController {
  constructor(private readonly narrativeRunsService: NarrativeRunsService) {}

  @Get()
  @Permissions('narratives:run')
  listActive(@CurrentUser() user: AuthenticatedUser) {
    return this.narrativeRunsService.listActive(user);
  }

  @Get(':id')
  @Permissions('narratives:run')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.narrativeRunsService.findOne(user, id);
  }

  @Patch(':id/current-node')
  @Permissions('narratives:run')
  updateCurrentNode(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCurrentNodeDto,
  ) {
    return this.narrativeRunsService.updateCurrentNode(user, id, dto);
  }

  @Post(':id/events')
  @Permissions('narratives:run')
  recordEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateRunEventDto,
  ) {
    return this.narrativeRunsService.recordEvent(user, id, dto);
  }

  @Post(':id/dynamic-audio')
  @Permissions('narratives:run')
  generateDynamicAudio(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: GenerateDynamicAudioDto,
  ) {
    return this.narrativeRunsService.generateDynamicAudio(user, id, dto);
  }

  @Post(':id/complete')
  @Permissions('narratives:run')
  complete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.narrativeRunsService.complete(user, id);
  }

  @Post(':id/cancel')
  @Permissions('narratives:run')
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.narrativeRunsService.cancel(user, id);
  }
}
