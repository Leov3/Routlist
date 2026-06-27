import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AccessModule } from '../../common/decorators/access-module.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import type { AuthenticatedUser } from '../../shared/types/authenticated-user';
import { AudioLibraryService } from './audio-library.service';
import { BulkAudioAssetsDto } from './dto/bulk-audio-assets.dto';
import { UpdateAudioAssetDto } from './dto/update-audio-asset.dto';

@ApiTags('audio-assets')
@ApiCookieAuth('cookie')
@Controller('audio-assets')
@AccessModule('admin.audios')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AudioLibraryController {
  constructor(private readonly audioLibraryService: AudioLibraryService) {}

  private async pipeAudio(
    req: Request,
    res: Response,
    path: string,
    mimeType: string,
    fileName: string,
  ) {
    const fileStats = await stat(path);
    const fileSize = fileStats.size;
    const range = req.headers.range;

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Last-Modified', fileStats.mtime.toUTCString());

    if (!range) {
      res.setHeader('Content-Length', fileSize);
      createReadStream(path).pipe(res);
      return;
    }

    const [startRaw, endRaw] = range.replace(/bytes=/, '').split('-');
    const start = Number.parseInt(startRaw, 10);
    const end = endRaw ? Number.parseInt(endRaw, 10) : fileSize - 1;

    if (
      Number.isNaN(start) ||
      Number.isNaN(end) ||
      start < 0 ||
      end >= fileSize ||
      start > end
    ) {
      res.status(416);
      res.setHeader('Content-Range', `bytes */${fileSize}`);
      res.end();
      return;
    }

    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    res.setHeader('Content-Length', end - start + 1);
    createReadStream(path, { start, end }).pipe(res);
  }

  @Get()
  @Permissions('audio:read')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.audioLibraryService.list(user);
  }

  @Post()
  @Permissions('audio:create')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  create(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.audioLibraryService.create(user, file);
  }

  @Post('bulk')
  @Permissions('audio:update')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files'))
  bulk(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BulkAudioAssetsDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.audioLibraryService.bulk(user, dto, files);
  }

  @Post('import-csv')
  @Permissions('audio:update')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'csv', maxCount: 1 },
      { name: 'files', maxCount: 200 },
    ]),
  )
  importCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Body('paths') pathsJson: string | undefined,
    @UploadedFiles()
    files: {
      csv?: Express.Multer.File[];
      files?: Express.Multer.File[];
    },
  ) {
    return this.audioLibraryService.importCsv(user, files.csv?.[0], files.files ?? [], pathsJson);
  }

  @Post('import-csv/preview')
  @Permissions('audio:update')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'csv', maxCount: 1 },
      { name: 'files', maxCount: 200 },
    ]),
  )
  previewImportCsv(
    @Body('paths') pathsJson: string | undefined,
    @UploadedFiles()
    files: {
      csv?: Express.Multer.File[];
      files?: Express.Multer.File[];
    },
  ) {
    return this.audioLibraryService.previewCsv(files.csv?.[0], files.files ?? [], pathsJson);
  }

  @Get(':id')
  @Permissions('audio:read')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.audioLibraryService.findOne(user, id);
  }

  @Get(':id/stream')
  @Permissions('board:use')
  async stream(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const { asset, path } = await this.audioLibraryService.streamPath(user, id);
    await this.pipeAudio(req, res, path, asset.mimeType, asset.fileName);
  }

  @Get(':id/narrative-stream')
  @Permissions('narratives:run')
  async narrativeStream(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const { asset, path } = await this.audioLibraryService.streamPath(user, id);
    await this.pipeAudio(req, res, path, asset.mimeType, asset.fileName);
  }

  @Get(':id/download')
  @Permissions('board:use')
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { asset, path } = await this.audioLibraryService.downloadPath(user, id);
    res.setHeader('Content-Type', asset.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${asset.fileName}"`);
    createReadStream(path).pipe(res);
  }

  @Patch(':id')
  @Permissions('audio:update')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAudioAssetDto,
  ) {
    return this.audioLibraryService.update(user, id, dto);
  }

  @Delete(':id')
  @Permissions('audio:delete')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.audioLibraryService.remove(user, id);
  }
}
