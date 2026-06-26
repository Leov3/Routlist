import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { createReadStream, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { diskStorage } from 'multer';
import { join } from 'path';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AccessModule } from '../../common/decorators/access-module.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../shared/types/authenticated-user';
import { CreateMaintenanceBackupDto } from './dto/create-maintenance-backup.dto';
import { RestoreMaintenanceBackupDto } from './dto/restore-maintenance-backup.dto';
import { UpdateMaintenanceSettingsDto } from './dto/update-maintenance-settings.dto';
import { MaintenanceService } from './maintenance.service';

const RESTORE_UPLOAD_DIR = join(tmpdir(), 'routlis-maintenance-restore');

@ApiTags('maintenance')
@ApiCookieAuth('cookie')
@Controller('maintenance')
@AccessModule('admin.maintenance')
@UseGuards(JwtAuthGuard)
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Get('status')
  status(@CurrentUser() user: AuthenticatedUser) {
    return this.maintenanceService.status(user);
  }

  @Get('migrations')
  migrations(@CurrentUser() user: AuthenticatedUser) {
    return this.maintenanceService.migrations(user);
  }

  @Get('settings')
  settings(@CurrentUser() user: AuthenticatedUser) {
    return this.maintenanceService.settings(user);
  }

  @Patch('settings')
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateMaintenanceSettingsDto,
  ) {
    return this.maintenanceService.updateSettings(user, dto);
  }

  @Get('backups')
  backups(@CurrentUser() user: AuthenticatedUser) {
    return this.maintenanceService.listBackups(user);
  }

  @Post('backups')
  createBackup(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMaintenanceBackupDto,
  ) {
    return this.maintenanceService.createBackup(user, dto);
  }

  @Post('backups/import-restore')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        confirmRestore: {
          type: 'boolean',
          description:
            'Confirms the destructive restore over the current environment.',
        },
        databaseDump: {
          type: 'string',
          format: 'binary',
        },
        storageArchive: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['confirmRestore', 'databaseDump', 'storageArchive'],
    },
  })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'databaseDump', maxCount: 1 },
        { name: 'storageArchive', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: (_request, _file, callback) => {
            mkdirSync(RESTORE_UPLOAD_DIR, { recursive: true });
            callback(null, RESTORE_UPLOAD_DIR);
          },
          filename: (_request, file, callback) => {
            const safeOriginalName = file.originalname.replace(/[\\/]/g, '_');
            const safeName = `${Date.now()}-${Math.random().toString(16).slice(2)}-${safeOriginalName}`;
            callback(null, safeName);
          },
        }),
        limits: {
          files: 2,
        },
      },
    ),
  )
  restoreFromFiles(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RestoreMaintenanceBackupDto,
    @UploadedFiles()
    files: {
      databaseDump?: Express.Multer.File[];
      storageArchive?: Express.Multer.File[];
    },
  ) {
    return this.maintenanceService.restoreFromUploads(user, dto, files);
  }

  @Get('backups/:id/download')
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { backup, path } = await this.maintenanceService.downloadPath(
      user,
      id,
    );
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${backup.archiveFileName}"`,
    );
    createReadStream(path).pipe(res);
  }

  @Get('backups/:id/database-download')
  async downloadDatabase(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { backup, path } = await this.maintenanceService.downloadDatabasePath(
      user,
      id,
    );
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${backup.databaseDumpFileName ?? `${backup.id}-db.dump`}"`,
    );
    createReadStream(path).pipe(res);
  }

  @Get('backups/:id/storage-download')
  async downloadStorage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { backup, stream, child, archiveName } =
      await this.maintenanceService.downloadStoragePath(user, id);
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${archiveName}"`,
    );
    res.on('close', () => {
      child.kill('SIGTERM');
    });
    stream.pipe(res);
  }

  @Post('backups/:id/restore')
  restore(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.maintenanceService.restoreBackup(user, id);
  }

  @Delete('backups/:id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.maintenanceService.deleteBackup(user, id);
  }
}
