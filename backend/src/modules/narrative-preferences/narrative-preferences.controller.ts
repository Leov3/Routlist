import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../shared/types/authenticated-user';
import { NarrativePreferencesService } from './narrative-preferences.service';
import { UpdateNarrativePreferencesDto } from './dto/update-narrative-preferences.dto';

@ApiTags('narrative-preferences')
@ApiCookieAuth('cookie')
@Controller('me/narrative-preferences')
@UseGuards(JwtAuthGuard)
export class NarrativePreferencesController {
  constructor(private readonly narrativePreferencesService: NarrativePreferencesService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.narrativePreferencesService.get(user);
  }

  @Patch()
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateNarrativePreferencesDto) {
    return this.narrativePreferencesService.update(user, dto);
  }
}
