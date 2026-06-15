import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Prisma,
  type MaintenanceBackup,
  type MaintenanceBackupSetting,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { mkdir, readdir, rm, stat, writeFile } from 'fs/promises';
import { join } from 'path';
import { promisify } from 'util';
import { execFile, spawn, type ChildProcess } from 'child_process';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../shared/types/authenticated-user';
import type {
  MaintenanceAuditItem,
  MaintenanceBackupListItem,
  MaintenanceBackupSettings,
  MaintenanceMigrationStatus,
  MaintenanceStatusResponse,
} from './maintenance.types';
import { CreateMaintenanceBackupDto } from './dto/create-maintenance-backup.dto';
import { RestoreMaintenanceBackupDto } from './dto/restore-maintenance-backup.dto';
import { UpdateMaintenanceSettingsDto } from './dto/update-maintenance-settings.dto';

const SCHEDULER_INTERVAL_MS = 60 * 1000;
const DEFAULT_RETENTION_DAYS = 7;
const DEFAULT_EVERY_HOURS = 24;
const MAX_DATABASE_BACKUPS = 3;

type MigrationRow = {
  migration_name: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
  started_at: Date | null;
  applied_steps_count: number | null;
};

type MaintenanceRestoreFiles = {
  databaseDump?: Express.Multer.File[];
  storageArchive?: Express.Multer.File[];
};

@Injectable()
export class MaintenanceService implements OnModuleInit, OnModuleDestroy {
  private readonly execFileAsync = promisify(execFile);
  private scheduler: NodeJS.Timeout | null = null;
  private readonly activeLocks = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    void this.runScheduledMaintenance();
    void this.cleanupAllDatabaseBackupRetention();
    this.scheduler = setInterval(() => {
      void this.runScheduledMaintenance();
    }, SCHEDULER_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.scheduler) {
      clearInterval(this.scheduler);
      this.scheduler = null;
    }
  }

  async status(user: AuthenticatedUser): Promise<MaintenanceStatusResponse> {
    this.ensureOwner(user);

    const [migration, settings, backups, audit, backupBytes] =
      await Promise.all([
        this.getMigrationStatus(),
        this.ensureSettings(user.organizationId),
        this.listBackups(user),
        this.listAudit(user),
        this.directorySize(this.backupRootPath()),
      ]);

    return {
      migration,
      settings: this.serializeSettings(settings),
      backups,
      audit,
      storage: {
        backupRootPath: this.backupRootPath(),
        backupBytes,
      },
    };
  }

  async migrations(
    user: AuthenticatedUser,
  ): Promise<MaintenanceMigrationStatus> {
    this.ensureOwner(user);
    return this.getMigrationStatus();
  }

  async settings(user: AuthenticatedUser): Promise<MaintenanceBackupSettings> {
    this.ensureOwner(user);
    const settings = await this.ensureSettings(user.organizationId);
    return this.serializeSettings(settings);
  }

  async updateSettings(
    user: AuthenticatedUser,
    dto: UpdateMaintenanceSettingsDto,
  ): Promise<MaintenanceBackupSettings> {
    this.ensureOwner(user);
    const settings = await this.ensureSettings(user.organizationId);
    const nextScheduleMode = dto.scheduleMode ?? settings.scheduleMode;
    const isEnabled = dto.isEnabled ?? settings.isEnabled;
    const everyHours = dto.everyHours ?? settings.everyHours;
    const retentionDays = dto.retentionDays ?? settings.retentionDays;

    const updated = await this.prisma.maintenanceBackupSetting.update({
      where: { organizationId: user.organizationId },
      data: {
        isEnabled,
        includeDatabase:
          typeof dto.includeDatabase === 'boolean'
            ? dto.includeDatabase
            : settings.includeDatabase,
        includeStorage:
          typeof dto.includeStorage === 'boolean'
            ? dto.includeStorage
            : settings.includeStorage,
        scheduleMode: nextScheduleMode,
        everyHours,
        retentionDays,
        nextRunAt:
          isEnabled && nextScheduleMode === 'EVERY_HOURS'
            ? this.computeNextRunAt(new Date(), everyHours)
            : null,
      },
    });

    await this.writeAudit(
      user,
      'MAINTENANCE_SETTINGS_UPDATED',
      'MaintenanceBackupSetting',
      updated.id,
      {
        isEnabled: updated.isEnabled,
        includeDatabase: updated.includeDatabase,
        includeStorage: updated.includeStorage,
        scheduleMode: updated.scheduleMode,
        everyHours: updated.everyHours,
        retentionDays: updated.retentionDays,
      },
    ).catch(() => undefined);

    return this.serializeSettings(updated);
  }

  async listBackups(
    user: AuthenticatedUser,
  ): Promise<MaintenanceBackupListItem[]> {
    this.ensureOwner(user);
    const backups = await this.prisma.maintenanceBackup.findMany({
      where: { organizationId: user.organizationId },
      orderBy: [{ createdAt: 'desc' }],
      take: 50,
      include: {
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    return backups.map((backup) => this.serializeBackup(backup));
  }

  async createBackup(
    user: AuthenticatedUser,
    dto: CreateMaintenanceBackupDto,
    source: 'MANUAL' | 'SCHEDULED' = 'MANUAL',
  ): Promise<MaintenanceBackupListItem> {
    this.ensureOwner(user);
    return this.withLock(user.organizationId, async () => {
      const settings = await this.ensureSettings(user.organizationId);
      const includeDatabase =
        typeof dto.includeDatabase === 'boolean'
          ? dto.includeDatabase
          : settings.includeDatabase;
      const includeStorage =
        typeof dto.includeStorage === 'boolean'
          ? dto.includeStorage
          : settings.includeStorage;

      if (!includeDatabase && !includeStorage) {
        throw new BadRequestException(
          'Debes incluir base de datos, storage o ambos.',
        );
      }

      const backupId = randomUUID();

      const backup = await this.prisma.maintenanceBackup.create({
        data: {
          id: backupId,
          organizationId: user.organizationId,
          createdById: user.id,
          source,
          status: 'RUNNING',
          label: dto.label?.trim() || null,
          includeDatabase,
          includeStorage,
          backupDirectoryKey: this.backupDirectoryKey(
            user.organizationId,
            backupId,
          ),
          archiveFileName: `${backupId}.tar.gz`,
          sizeBytes: 0,
          startedAt: new Date(),
        },
      });

      const backupRoot = this.organizationBackupRoot(
        user.organizationId,
        backup.id,
      );
      const archivePath = join(
        this.organizationBackupParent(user.organizationId),
        `${backup.id}.tar.gz`,
      );
      const manifestPath = join(backupRoot, 'manifest.json');
      const databaseDumpName = includeDatabase ? 'postgres.dump' : null;
      const databaseDumpPath = databaseDumpName
        ? join(backupRoot, databaseDumpName)
        : null;
      await mkdir(backupRoot, { recursive: true });

      try {
        if (includeDatabase && databaseDumpPath) {
          await this.execFileAsync('pg_dump', [
            '--format=custom',
            '--file',
            databaseDumpPath,
            '--dbname',
            this.databaseBackupUrl(),
            '--no-owner',
            '--no-privileges',
          ]);
        }

        await writeFile(
          manifestPath,
          JSON.stringify(
            {
              id: backup.id,
              organizationId: user.organizationId,
              source,
              label: dto.label?.trim() || null,
              includeDatabase,
              includeStorage,
              createdById: user.id,
              createdAt: new Date().toISOString(),
              databaseDumpFileName: databaseDumpName,
              storageArchiveFileName: null,
            },
            null,
            2,
          ),
        );

        await this.execFileAsync('tar', [
          '-czf',
          archivePath,
          '-C',
          this.organizationBackupParent(user.organizationId),
          backup.id,
        ]);

        const sizeBytes =
          (await this.directorySize(backupRoot)) +
          (await this.safeFileSize(archivePath));

        const expiresAt = this.computeExpiresAt(settings.retentionDays);
        const completed = await this.prisma.maintenanceBackup.update({
          where: { id: backup.id },
          data: {
            backupDirectoryKey: this.backupDirectoryKey(
              user.organizationId,
              backup.id,
            ),
            archiveFileName: `${backup.id}.tar.gz`,
            databaseDumpFileName: databaseDumpName,
            storageArchiveFileName: null,
            sizeBytes,
            expiresAt,
            status: 'COMPLETED',
            completedAt: new Date(),
          },
          include: {
            createdBy: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        });

        await this.writeAudit(
          user,
          source === 'SCHEDULED'
            ? 'MAINTENANCE_BACKUP_SCHEDULED'
            : 'MAINTENANCE_BACKUP_CREATED',
          'MaintenanceBackup',
          completed.id,
          {
            includeDatabase,
            includeStorage,
            sizeBytes,
            label: dto.label?.trim() || null,
          },
        ).catch(() => undefined);

        await this.cleanupDatabaseBackupRetention(user.organizationId);

        return this.serializeBackup(completed);
      } catch (error) {
        await this.prisma.maintenanceBackup.update({
          where: { id: backup.id },
          data: {
            status: 'FAILED',
            errorMessage: this.errorMessage(error),
            completedAt: new Date(),
          },
        });

        await rm(backupRoot, { recursive: true, force: true }).catch(
          () => undefined,
        );
        await rm(archivePath, { force: true }).catch(() => undefined);

        throw new ServiceUnavailableException(
          'No se pudo crear el backup. Revisa que pg_dump esté disponible y que la base de datos responda.',
        );
      }
    });
  }

  async downloadPath(user: AuthenticatedUser, id: string) {
    this.ensureOwner(user);
    const backup = await this.backupOrThrow(user.organizationId, id);
    const archivePath = this.organizationBackupArchivePath(
      user.organizationId,
      backup.id,
    );
    return { backup: this.serializeBackup(backup), path: archivePath };
  }

  async downloadDatabasePath(user: AuthenticatedUser, id: string) {
    this.ensureOwner(user);
    const backup = await this.backupOrThrow(user.organizationId, id);

    if (!backup.includeDatabase || !backup.databaseDumpFileName) {
      throw new NotFoundException(
        'Database dump not available for this backup',
      );
    }

    const backupRoot = this.organizationBackupRoot(
      user.organizationId,
      backup.id,
    );
    const path = join(backupRoot, backup.databaseDumpFileName);

    return { backup: this.serializeBackup(backup), path };
  }

  async downloadStoragePath(user: AuthenticatedUser, id: string) {
    this.ensureOwner(user);
    const backup = await this.backupOrThrow(user.organizationId, id);

    if (!backup.includeStorage) {
      throw new NotFoundException(
        'Storage archive not available for this backup',
      );
    }

    const archiveName = `${backup.id}-storage.tar.gz`;
    const { stream, child } = await this.createStorageArchiveStream();

    return { backup: this.serializeBackup(backup), stream, child, archiveName };
  }

  async restoreBackup(user: AuthenticatedUser, id: string) {
    this.ensureOwner(user);
    return this.withLock(user.organizationId, async () => {
      const backup = await this.backupOrThrow(user.organizationId, id);
      const backupRoot = this.organizationBackupRoot(
        user.organizationId,
        backup.id,
      );
      const databaseDumpPath = backup.databaseDumpFileName
        ? join(backupRoot, backup.databaseDumpFileName)
        : null;
      const storageArchivePath = backup.storageArchiveFileName
        ? join(backupRoot, backup.storageArchiveFileName)
        : null;

      if (backup.includeDatabase && databaseDumpPath) {
        await this.execFileAsync('pg_restore', [
          '--clean',
          '--if-exists',
          '--no-owner',
          '--no-privileges',
          '--dbname',
          this.databaseBackupUrl(),
          databaseDumpPath,
        ]);
      }

      if (backup.includeStorage && storageArchivePath) {
        await mkdir(this.storageRootPath(), { recursive: true });
        await this.clearStorageRoot();
        await this.execFileAsync('tar', [
          '-xzf',
          storageArchivePath,
          '-C',
          this.storageRootPath(),
        ]);
      }

      await this.writeAudit(
        user,
        'MAINTENANCE_BACKUP_RESTORED',
        'MaintenanceBackup',
        backup.id,
        {
          includeDatabase: backup.includeDatabase,
          includeStorage: backup.includeStorage,
        },
      ).catch(() => undefined);

      return {
        ok: true,
        restoredAt: new Date().toISOString(),
      };
    });
  }

  async restoreFromUploads(
    user: AuthenticatedUser,
    dto: RestoreMaintenanceBackupDto,
    files: MaintenanceRestoreFiles,
  ) {
    this.ensureOwner(user);
    return this.withLock(user.organizationId, async () => {
      if (!dto.confirmRestore) {
        throw new BadRequestException(
          'Debes confirmar la restauración antes de continuar.',
        );
      }

      const databaseDump = files.databaseDump?.[0];
      const storageArchive = files.storageArchive?.[0];

      if (!databaseDump || !storageArchive) {
        throw new BadRequestException(
          'Debes subir un dump de base de datos y un archivo de storage.',
        );
      }

      const cleanupFiles = [databaseDump.path, storageArchive.path];

      try {
        await this.validateDatabaseDump(databaseDump.path);
        await this.validateStorageArchive(storageArchive.path);

        await this.execFileAsync('pg_restore', [
          '--clean',
          '--if-exists',
          '--no-owner',
          '--no-privileges',
          '--dbname',
          this.databaseBackupUrl(),
          databaseDump.path,
        ]);

        await mkdir(this.storageRootPath(), { recursive: true });
        await this.clearStorageRoot();
        await this.execFileAsync('tar', [
          '-xzf',
          storageArchive.path,
          '-C',
          this.storageRootPath(),
        ]);

        await this.writeAudit(
          user,
          'MAINTENANCE_BACKUP_RESTORED_FROM_UPLOADS',
          'MaintenanceBackup',
          null,
          {
            databaseDumpFileName: databaseDump.originalname,
            storageArchiveFileName: storageArchive.originalname,
            databaseDumpSize: databaseDump.size,
            storageArchiveSize: storageArchive.size,
          },
        ).catch(() => undefined);

        return {
          ok: true,
          restoredAt: new Date().toISOString(),
        };
      } catch (error) {
        await this.writeAudit(
          user,
          'MAINTENANCE_BACKUP_RESTORE_FROM_UPLOADS_FAILED',
          'MaintenanceBackup',
          null,
          {
            databaseDumpFileName: databaseDump.originalname,
            storageArchiveFileName: storageArchive.originalname,
            error: this.errorMessage(error),
          },
        ).catch(() => undefined);

        if (error instanceof BadRequestException) {
          throw error;
        }

        throw new ServiceUnavailableException(
          'No se pudo restaurar desde los archivos cargados. Revisa que el dump sea compatible y que el archivo de storage esté íntegro.',
        );
      } finally {
        await Promise.all(
          cleanupFiles.map(async (path) => {
            await rm(path, { force: true }).catch(() => undefined);
          }),
        );
      }
    });
  }

  async deleteBackup(user: AuthenticatedUser, id: string) {
    this.ensureOwner(user);
    const backup = await this.backupOrThrow(user.organizationId, id);
    await this.removeBackupArtifacts(user.organizationId, backup.id);
    await this.prisma.maintenanceBackup.delete({
      where: { id: backup.id },
    });

    await this.writeAudit(
      user,
      'MAINTENANCE_BACKUP_DELETED',
      'MaintenanceBackup',
      backup.id,
      {
        label: backup.label,
      },
    ).catch(() => undefined);

    return { ok: true };
  }

  async cleanupExpiredBackups() {
    const expired = await this.prisma.maintenanceBackup.findMany({
      where: {
        expiresAt: {
          lte: new Date(),
        },
      },
      select: {
        id: true,
        organizationId: true,
      },
      take: 100,
    });

    for (const backup of expired) {
      await this.removeBackupArtifacts(backup.organizationId, backup.id);
      await this.prisma.maintenanceBackup.delete({
        where: { id: backup.id },
      });
    }
  }

  async cleanupDatabaseBackupRetention(organizationId: string) {
    const backups = await this.prisma.maintenanceBackup.findMany({
      where: {
        organizationId,
        status: 'COMPLETED',
        includeDatabase: true,
      },
      orderBy: [{ createdAt: 'desc' }],
      skip: MAX_DATABASE_BACKUPS,
      select: {
        id: true,
        organizationId: true,
      },
    });

    for (const backup of backups) {
      await this.removeBackupArtifacts(backup.organizationId, backup.id);
      await this.prisma.maintenanceBackup.delete({
        where: { id: backup.id },
      });
    }
  }

  async cleanupAllDatabaseBackupRetention() {
    const organizations = await this.prisma.maintenanceBackup.findMany({
      where: {
        includeDatabase: true,
        status: 'COMPLETED',
      },
      select: {
        organizationId: true,
      },
      distinct: ['organizationId'],
    });

    for (const organization of organizations) {
      await this.cleanupDatabaseBackupRetention(organization.organizationId);
    }
  }

  private async runScheduledMaintenance() {
    const now = new Date();
    const scheduledSettings =
      await this.prisma.maintenanceBackupSetting.findMany({
        where: {
          isEnabled: true,
          scheduleMode: 'EVERY_HOURS',
          OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }],
        },
        select: {
          organizationId: true,
          includeDatabase: true,
          includeStorage: true,
          everyHours: true,
        },
        take: 20,
      });

    for (const settings of scheduledSettings) {
      const key = this.lockKey(settings.organizationId);
      if (this.activeLocks.has(key)) {
        continue;
      }

      try {
        const organizationUser = await this.findAnyOrganizationOwner(
          settings.organizationId,
        );
        if (!organizationUser) {
          continue;
        }

        await this.createBackup(
          organizationUser,
          {
            includeDatabase: settings.includeDatabase,
            includeStorage: settings.includeStorage,
            label: 'Backup automático',
          },
          'SCHEDULED',
        );

        await this.prisma.maintenanceBackupSetting.update({
          where: { organizationId: settings.organizationId },
          data: {
            lastRunAt: new Date(),
            nextRunAt: this.computeNextRunAt(new Date(), settings.everyHours),
          },
        });

        await this.cleanupExpiredBackups();
      } catch {
        continue;
      }
    }

    await this.cleanupExpiredBackups();
    await this.cleanupAllDatabaseBackupRetention();
  }

  private async findAnyOrganizationOwner(organizationId: string) {
    const member = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
        role: {
          name: 'OWNER',
        },
        status: 'ACTIVE',
      },
      select: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });

    if (!member?.user) {
      return null;
    }

    return {
      id: member.user.id,
      email: member.user.email,
      fullName: member.user.fullName,
      role: 'OWNER',
      organizationId,
      permissions: ['organization:read'],
    } as AuthenticatedUser;
  }

  private async ensureSettings(organizationId: string) {
    return this.prisma.maintenanceBackupSetting.upsert({
      where: { organizationId },
      update: {},
      create: {
        organizationId,
        isEnabled: false,
        includeDatabase: true,
        includeStorage: true,
        scheduleMode: 'MANUAL',
        everyHours: DEFAULT_EVERY_HOURS,
        retentionDays: DEFAULT_RETENTION_DAYS,
      },
    });
  }

  private async getMigrationStatus(): Promise<MaintenanceMigrationStatus> {
    const migrationsDir = join(process.cwd(), 'prisma', 'migrations');
    const dbRows = await this.prisma.$queryRaw<MigrationRow[]>`
      SELECT
        migration_name,
        finished_at,
        rolled_back_at,
        started_at,
        applied_steps_count
      FROM "_prisma_migrations"
      ORDER BY started_at DESC
    `;

    const applied = dbRows.map((row) => ({
      name: row.migration_name,
      finishedAt: row.finished_at
        ? new Date(row.finished_at).toISOString()
        : null,
      rolledBackAt: row.rolled_back_at
        ? new Date(row.rolled_back_at).toISOString()
        : null,
      startedAt: row.started_at ? new Date(row.started_at).toISOString() : null,
      appliedStepsCount: row.applied_steps_count,
    }));

    const dbAppliedNames = new Set(applied.map((item) => item.name));
    const migrationDirs = await readdir(migrationsDir, {
      withFileTypes: true,
    }).catch(() => []);
    const available = migrationDirs
      .filter(
        (entry) => entry.isDirectory() && entry.name !== 'migration_lock.toml',
      )
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));
    const pending = available.filter((name) => !dbAppliedNames.has(name));
    const lastAppliedAt =
      applied.find((item) => item.finishedAt)?.finishedAt ?? null;

    return {
      currentVersion: applied[0]?.name ?? null,
      appliedCount: applied.length,
      pendingCount: pending.length,
      applied,
      pending,
      lastAppliedAt,
    };
  }

  private serializeSettings(
    settings: MaintenanceBackupSetting,
  ): MaintenanceBackupSettings {
    return {
      id: settings.id,
      isEnabled: settings.isEnabled,
      includeDatabase: settings.includeDatabase,
      includeStorage: settings.includeStorage,
      scheduleMode:
        settings.scheduleMode === 'EVERY_HOURS' ? 'EVERY_HOURS' : 'MANUAL',
      everyHours: settings.everyHours,
      retentionDays: settings.retentionDays,
      lastRunAt: settings.lastRunAt ? settings.lastRunAt.toISOString() : null,
      nextRunAt: settings.nextRunAt ? settings.nextRunAt.toISOString() : null,
      createdAt: settings.createdAt.toISOString(),
      updatedAt: settings.updatedAt.toISOString(),
    };
  }

  private serializeBackup(
    backup: MaintenanceBackup & {
      createdBy?: { id: string; fullName: string; email: string } | null;
    },
  ): MaintenanceBackupListItem {
    return {
      id: backup.id,
      label: backup.label,
      source: backup.source,
      status: backup.status,
      includeDatabase: backup.includeDatabase,
      includeStorage: backup.includeStorage,
      archiveFileName: backup.archiveFileName,
      databaseDumpFileName: backup.databaseDumpFileName,
      storageArchiveFileName: backup.storageArchiveFileName,
      sizeBytes: backup.sizeBytes,
      expiresAt: backup.expiresAt ? backup.expiresAt.toISOString() : null,
      startedAt: backup.startedAt.toISOString(),
      completedAt: backup.completedAt ? backup.completedAt.toISOString() : null,
      errorMessage: backup.errorMessage,
      createdAt: backup.createdAt.toISOString(),
      updatedAt: backup.updatedAt.toISOString(),
      createdBy: backup.createdBy
        ? {
            id: backup.createdBy.id,
            fullName: backup.createdBy.fullName,
            email: backup.createdBy.email,
          }
        : null,
      downloadUrl: `/maintenance/backups/${backup.id}/download`,
      databaseDownloadUrl: backup.databaseDumpFileName
        ? `/maintenance/backups/${backup.id}/database-download`
        : null,
      storageDownloadUrl: backup.includeStorage
        ? `/maintenance/backups/${backup.id}/storage-download`
        : null,
    };
  }

  private async listAudit(
    user: AuthenticatedUser,
  ): Promise<MaintenanceAuditItem[]> {
    const events = await this.prisma.systemAuditEvent.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        user: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    return events.map((event) => ({
      id: event.id,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      payload: (event.payload as Record<string, unknown> | null) ?? null,
      createdAt: event.createdAt.toISOString(),
      user: event.user
        ? {
            id: event.user.id,
            fullName: event.user.fullName,
            email: event.user.email,
          }
        : null,
    }));
  }

  private async writeAudit(
    user: AuthenticatedUser | null,
    action: string,
    entityType: string,
    entityId?: string | null,
    payload?: Record<string, unknown>,
  ) {
    if (!user) {
      return;
    }

    await this.prisma.systemAuditEvent.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        action,
        entityType,
        entityId: entityId ?? null,
        payload: payload ? (payload as Prisma.InputJsonValue) : undefined,
      },
    });
  }

  private async backupOrThrow(organizationId: string, id: string) {
    const backup = await this.prisma.maintenanceBackup.findFirst({
      where: { id, organizationId },
      include: {
        createdBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    if (!backup) {
      throw new NotFoundException('Backup not found');
    }

    return backup;
  }

  private ensureOwner(user: AuthenticatedUser) {
    if (user.role !== 'OWNER') {
      throw new ForbiddenException(
        'Only OWNER can manage migrations and backups',
      );
    }
  }

  private lockKey(organizationId: string) {
    return `maintenance:${organizationId}`;
  }

  private async withLock<T>(
    organizationId: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const key = this.lockKey(organizationId);
    if (this.activeLocks.has(key)) {
      throw new ConflictException(
        'Ya existe una operación de mantenimiento en curso.',
      );
    }

    this.activeLocks.add(key);
    try {
      return await fn();
    } finally {
      this.activeLocks.delete(key);
    }
  }

  private storageRootPath() {
    return (
      this.configService.get<string>('storage.localStoragePath') ??
      '/var/www/routlis/storage'
    );
  }

  private backupRootPath() {
    return (
      this.configService.get<string>('storage.localBackupPath') ??
      join(this.storageRootPath(), 'backups')
    );
  }

  private databaseUrl() {
    return process.env.DATABASE_URL ?? '';
  }

  private databaseBackupUrl() {
    const url = this.databaseUrl();
    if (!url) {
      return url;
    }

    try {
      const parsed = new URL(url);
      parsed.searchParams.delete('schema');
      return parsed.toString();
    } catch {
      return url.replace(/[?&]schema=[^&]+/g, '').replace(/[?&]$/, '');
    }
  }

  private organizationBackupParent(organizationId: string) {
    return join(this.backupRootPath(), organizationId);
  }

  private organizationBackupRoot(organizationId: string, backupId: string) {
    return join(this.organizationBackupParent(organizationId), backupId);
  }

  private organizationBackupArchivePath(
    organizationId: string,
    backupId: string,
  ) {
    return join(
      this.organizationBackupParent(organizationId),
      `${backupId}.tar.gz`,
    );
  }

  private backupDirectoryKey(organizationId: string, backupId: string) {
    return join(organizationId, backupId);
  }

  private async storageEntriesForArchive() {
    const entries = await readdir(this.storageRootPath(), {
      withFileTypes: true,
    }).catch(() => []);
    return entries
      .filter((entry) => entry.name !== 'backups')
      .map((entry) => entry.name);
  }

  private async createStorageArchiveStream(): Promise<{
    stream: NonNullable<ChildProcess['stdout']>;
    child: ChildProcess;
  }> {
    const entries = await this.storageEntriesForArchive();
    if (!entries.length) {
      throw new NotFoundException(
        'Storage archive not available for this backup',
      );
    }

    const child = spawn(
      'tar',
      ['-czf', '-', '-C', this.storageRootPath(), ...entries],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    return {
      stream: child.stdout,
      child,
    };
  }

  private async validateDatabaseDump(path: string) {
    try {
      await this.execFileAsync('pg_restore', ['--list', path]);
    } catch (error) {
      throw new BadRequestException(
        `El archivo de base de datos no es un dump válido de PostgreSQL compatible con pg_restore: ${this.errorMessage(error)}`,
      );
    }
  }

  private async validateStorageArchive(path: string) {
    try {
      await this.execFileAsync('tar', ['-tzf', path]);
    } catch (error) {
      throw new BadRequestException(
        `El archivo de storage no es un archive tar.gz válido: ${this.errorMessage(error)}`,
      );
    }
  }

  private async removeBackupArtifacts(
    organizationId: string,
    backupId: string,
  ) {
    const archivePath = this.organizationBackupArchivePath(
      organizationId,
      backupId,
    );
    const backupRoot = this.organizationBackupRoot(organizationId, backupId);
    await rm(archivePath, { force: true }).catch(() => undefined);
    await rm(backupRoot, { recursive: true, force: true }).catch(
      () => undefined,
    );
  }

  private async clearStorageRoot() {
    const root = this.storageRootPath();
    await mkdir(root, { recursive: true });
    const entries = await readdir(root, { withFileTypes: true }).catch(
      () => [],
    );

    await Promise.all(
      entries.map(async (entry) => {
        if (entry.name === 'backups') {
          return;
        }

        await rm(join(root, entry.name), {
          recursive: true,
          force: true,
        }).catch(() => undefined);
      }),
    );
  }

  private computeNextRunAt(reference: Date, everyHours: number) {
    return new Date(reference.getTime() + everyHours * 60 * 60 * 1000);
  }

  private computeExpiresAt(retentionDays: number) {
    return new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);
  }

  private async directorySize(path: string): Promise<number> {
    try {
      const entry = await stat(path);
      if (!entry.isDirectory()) {
        return entry.size;
      }

      const entries = await readdir(path, { withFileTypes: true });
      const sizes = await Promise.all(
        entries.map(async (item) => {
          const itemPath = join(path, item.name);
          if (item.isDirectory()) {
            return this.directorySize(itemPath);
          }

          if (item.isFile()) {
            const file = await stat(itemPath);
            return file.size;
          }

          return 0;
        }),
      );

      return sizes.reduce((total, size) => total + size, 0);
    } catch {
      return 0;
    }
  }

  private async safeFileSize(path: string) {
    try {
      return (await stat(path)).size;
    } catch {
      return 0;
    }
  }

  private errorMessage(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Unexpected maintenance error';
  }
}
