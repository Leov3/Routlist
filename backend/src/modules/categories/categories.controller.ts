import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import type { AuthenticatedUser } from '../../shared/types/authenticated-user';
import { CategoriesService } from './categories.service';
import { CreateAudioCategoryDto } from './dto/create-audio-category.dto';
import { ReorderAudioCategoriesDto } from './dto/reorder-audio-categories.dto';
import { UpdateAudioCategoryDto } from './dto/update-audio-category.dto';

@ApiTags('audio-categories')
@ApiCookieAuth('cookie')
@Controller('audio-categories')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @Permissions('category:read')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.categoriesService.list(user);
  }

  @Post()
  @Permissions('category:create')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAudioCategoryDto,
  ) {
    return this.categoriesService.create(user, dto);
  }

  @Patch(':id')
  @Permissions('category:update')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAudioCategoryDto,
  ) {
    return this.categoriesService.update(user, id, dto);
  }

  @Delete(':id')
  @Permissions('category:delete')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.categoriesService.remove(user, id);
  }

  @Patch('reorder')
  @Permissions('category:update')
  reorder(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReorderAudioCategoriesDto,
  ) {
    return this.categoriesService.reorder(user, dto.ids);
  }
}
