import { Body, Controller, Delete, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AccessModule } from '../../../common/decorators/access-module.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import type { AuthenticatedUser } from '../../../shared/types/authenticated-user';
import { ElevenLabsService } from './elevenlabs.service';
import { ElevenLabsSettingsDto, GenerateElevenLabsAudioDto } from './dto/elevenlabs-settings.dto';

@ApiTags('integrations-elevenlabs')
@ApiCookieAuth('cookie')
@Controller('integrations/elevenlabs')
@AccessModule('admin.integrations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ElevenLabsController {
  constructor(private readonly elevenLabsService: ElevenLabsService) {}

  @Get('settings')
  @Permissions('integration:manage')
  getSettings(@CurrentUser() user: AuthenticatedUser) {
    return this.elevenLabsService.getSettings(user);
  }

  @Patch('settings')
  @Permissions('integration:manage')
  saveSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ElevenLabsSettingsDto,
  ) {
    return this.elevenLabsService.updateSettings(user, dto);
  }

  @Post('test')
  @Permissions('integration:manage')
  testConnection(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ElevenLabsSettingsDto,
  ) {
    return this.elevenLabsService.testConnection(user, dto);
  }

  @Get('voices')
  voices(@CurrentUser() user: AuthenticatedUser) {
    return this.elevenLabsService.listVoices(user);
  }

  @Get('models')
  models(@CurrentUser() user: AuthenticatedUser) {
    return this.elevenLabsService.listModels(user);
  }

  @Post('generate-test')
  @Permissions('integration:manage')
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateElevenLabsAudioDto,
  ) {
    return this.elevenLabsService.generateTestAudio(user, dto);
  }

  @Delete('settings')
  @Permissions('integration:manage')
  disconnect(@CurrentUser() user: AuthenticatedUser) {
    return this.elevenLabsService.deleteSettings(user);
  }
}
