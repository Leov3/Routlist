import { Controller, Delete, Get, Param, Patch, Post, Res, Body, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { createReadStream } from 'fs';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../shared/types/authenticated-user';
import { CreateMaintenanceBackupDto } from './dto/create-maintenance-backup.dto';
import { UpdateMaintenanceSettingsDto } from './dto/update-maintenance-settings.dto';
import { MaintenanceService } from './maintenance.service';

@ApiTags('maintenance')
@ApiCookieAuth('cookie')
@Controller('maintenance')
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

  @Get('backups/:id/download')
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { backup, path } = await this.maintenanceService.downloadPath(user, id);
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
    const { backup, path } = await this.maintenanceService.downloadDatabasePath(user, id);
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
    const { backup, stream, child, archiveName } = await this.maintenanceService.downloadStoragePath(user, id);
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
