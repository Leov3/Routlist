import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AccessModule } from '../../common/decorators/access-module.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import type { AuthenticatedUser } from '../../shared/types/authenticated-user';
import { AudioGenerationQueryDto } from './dto/audio-generation-query.dto';
import { CreateGeneratedButtonDto } from './dto/create-generated-button.dto';
import { GenerateAudioGenerationDto } from './dto/generate-audio-generation.dto';
import { AudioGenerationService } from './audio-generation.service';

@ApiTags('audio-generation')
@ApiCookieAuth('cookie')
@Controller('audio-generation')
@AccessModule('admin.audios')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AudioGenerationController {
  constructor(private readonly audioGenerationService: AudioGenerationService) {}

  @Get()
  @Permissions('audio:generate')
  listJobs(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AudioGenerationQueryDto,
  ) {
    return this.audioGenerationService.listJobs(user, query);
  }

  @Get('library')
  @Permissions('audio:generate')
  library(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AudioGenerationQueryDto,
  ) {
    return this.audioGenerationService.listLibrary(user, query);
  }

  @Get(':id')
  @Permissions('audio:generate')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.audioGenerationService.getJob(user, id);
  }

  @Post('generate')
  @Permissions('audio:generate')
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateAudioGenerationDto,
  ) {
    return this.audioGenerationService.generate(user, dto);
  }

  @Post(':id/retry')
  @Permissions('audio:generate')
  retry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: GenerateAudioGenerationDto,
  ) {
    return this.audioGenerationService.retry(user, id, dto);
  }

  @Post(':id/create-button')
  @Permissions('button:create')
  createButton(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateGeneratedButtonDto,
  ) {
    return this.audioGenerationService.createButton(user, id, dto);
  }

  @Delete(':id')
  @Permissions('audio:generate')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.audioGenerationService.delete(user, id);
  }
}
