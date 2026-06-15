import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../shared/types/authenticated-user';
import { AudioGenerationPreferencesService } from './audio-generation-preferences.service';
import { UpdateAudioGenerationPreferencesDto } from './dto/update-audio-generation-preferences.dto';

@ApiTags('audio-generation-preferences')
@ApiCookieAuth('cookie')
@Controller('me/audio-generation-preferences')
@UseGuards(JwtAuthGuard)
export class AudioGenerationPreferencesController {
  constructor(
    private readonly audioGenerationPreferencesService: AudioGenerationPreferencesService,
  ) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.audioGenerationPreferencesService.get(user);
  }

  @Patch()
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAudioGenerationPreferencesDto,
  ) {
    return this.audioGenerationPreferencesService.update(user, dto);
  }
}
