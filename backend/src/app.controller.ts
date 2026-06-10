import { Controller, ForbiddenException, Get, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from './common/decorators/current-user.decorator';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AppService } from './app.service';
import type { AuthenticatedUser } from './shared/types/authenticated-user';

@ApiTags('system')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getRoot() {
    return this.appService.getRoot();
  }

  @Get('health')
  health() {
    return this.appService.health();
  }

  @Get('health/stats')
  stats() {
    return this.appService.stats();
  }

  @Get('public/stats')
  publicStats() {
    return this.appService.publicStats();
  }

  @Get('health/storage')
  @ApiCookieAuth('cookie')
  @UseGuards(JwtAuthGuard)
  storageHealth(@CurrentUser() user: AuthenticatedUser) {
    if (user.role !== 'OWNER') {
      throw new ForbiddenException('Only OWNER can access storage health');
    }

    return this.appService.storageHealth();
  }
}
