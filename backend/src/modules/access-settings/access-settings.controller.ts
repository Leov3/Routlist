import { Body, Controller, ForbiddenException, Get, Put, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../shared/types/authenticated-user';
import { AccessSettingsService } from './access-settings.service';
import { UpdateAccessSettingsDto } from './dto/update-access-settings.dto';

@ApiTags('access-settings')
@ApiCookieAuth('cookie')
@Controller('access-settings')
@UseGuards(JwtAuthGuard)
export class AccessSettingsController {
  constructor(private readonly accessSettingsService: AccessSettingsService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser) {
    this.ensureOwner(user);
    return this.accessSettingsService.get();
  }

  @Put()
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateAccessSettingsDto) {
    this.ensureOwner(user);
    return this.accessSettingsService.update(dto);
  }

  private ensureOwner(user: AuthenticatedUser) {
    if (user.role !== 'OWNER') {
      throw new ForbiddenException('Only OWNER can manage access settings');
    }
  }
}
