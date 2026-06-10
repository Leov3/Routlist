import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { createReadStream } from 'fs';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import type { AuthenticatedUser } from '../../shared/types/authenticated-user';
import { AudioButtonsService } from './audio-buttons.service';
import { CreateAudioButtonDto } from './dto/create-audio-button.dto';
import { ReorderAudioButtonsDto } from './dto/reorder-audio-buttons.dto';
import { UpdateAudioButtonDto } from './dto/update-audio-button.dto';

@ApiTags('audio-buttons')
@ApiCookieAuth('cookie')
@Controller('audio-buttons')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AudioButtonsController {
  constructor(private readonly audioButtonsService: AudioButtonsService) {}

  @Get()
  @Permissions('button:read')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.audioButtonsService.list(user);
  }

  @Get('board')
  @Permissions('board:use')
  board(@CurrentUser() user: AuthenticatedUser) {
    return this.audioButtonsService.board(user);
  }

  @Post()
  @Permissions('button:create')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        categoryId: { type: 'string' },
        audioAssetId: { type: 'string' },
        label: { type: 'string' },
        description: { type: 'string' },
        color: { type: 'string' },
        shortcutKey: { type: 'string' },
        sortOrder: { type: 'number' },
        image: { type: 'string', format: 'binary' },
      },
      required: ['categoryId', 'audioAssetId', 'label'],
    },
  })
  @UseInterceptors(FileInterceptor('image'))
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAudioButtonDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.audioButtonsService.create(user, dto, image);
  }

  @Patch(':id')
  @Permissions('button:update')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        categoryId: { type: 'string' },
        audioAssetId: { type: 'string' },
        label: { type: 'string' },
        description: { type: 'string' },
        color: { type: 'string' },
        shortcutKey: { type: 'string' },
        sortOrder: { type: 'number' },
        isActive: { type: 'boolean' },
        image: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('image'))
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAudioButtonDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.audioButtonsService.update(user, id, dto, image);
  }

  @Delete(':id')
  @Permissions('button:delete')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.audioButtonsService.remove(user, id);
  }

  @Post(':id/favorite')
  @Permissions('board:use')
  favorite(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.audioButtonsService.toggleFavorite(user, id, true);
  }

  @Delete(':id/favorite')
  @Permissions('board:use')
  unfavorite(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.audioButtonsService.toggleFavorite(user, id, false);
  }

  @Post(':id/duplicate')
  @Permissions('button:create')
  duplicate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.audioButtonsService.duplicate(user, id);
  }

  @Patch('reorder')
  @Permissions('button:update')
  reorder(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReorderAudioButtonsDto,
  ) {
    return this.audioButtonsService.reorder(user, dto.ids);
  }

  @Get(':id/image')
  @Permissions('button:read')
  async image(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { asset, path } = await this.audioButtonsService.imagePath(user, id);
    res.setHeader('Content-Type', asset.imageMimeType ?? 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${asset.imageFileName}"`);
    createReadStream(path).pipe(res);
  }

  @Get(':id/image/download')
  @Permissions('button:read')
  async downloadImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { asset, path } = await this.audioButtonsService.imagePath(user, id);
    res.setHeader('Content-Type', asset.imageMimeType ?? 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${asset.imageFileName}"`);
    createReadStream(path).pipe(res);
  }
}
