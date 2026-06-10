import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../shared/types/authenticated-user';
import { BoardPreferencesService } from './board-preferences.service';
import { UpdateBoardPreferencesDto } from './dto/update-board-preferences.dto';

@ApiTags('board-preferences')
@ApiCookieAuth('cookie')
@Controller('me/board-preferences')
@UseGuards(JwtAuthGuard)
export class BoardPreferencesController {
  constructor(private readonly boardPreferencesService: BoardPreferencesService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.boardPreferencesService.get(user);
  }

  @Patch()
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateBoardPreferencesDto,
  ) {
    return this.boardPreferencesService.update(user, dto);
  }
}
