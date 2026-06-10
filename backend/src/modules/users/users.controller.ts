import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import type { AuthenticatedUser } from '../../shared/types/authenticated-user';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiCookieAuth('cookie')
@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Permissions('user:read')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.list(user);
  }

  @Post()
  @Permissions('user:create')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateUserDto) {
    return this.usersService.create(user, dto);
  }

  @Patch(':id')
  @Permissions('user:update')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(user, id, dto);
  }

  @Patch(':id/enable')
  @Permissions('user:update')
  enable(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.usersService.enable(user, id);
  }

  @Patch(':id/disable')
  @Permissions('user:disable')
  disable(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.usersService.disable(user, id);
  }
}
