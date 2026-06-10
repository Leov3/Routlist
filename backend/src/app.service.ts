import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readdir, stat, statfs } from 'fs/promises';
import { join, resolve } from 'path';
import { PrismaService } from './prisma/prisma.service';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

@Injectable()
export class AppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  getRoot() {
    return {
      name: 'Routlis AudioBoard API',
      status: 'ok',
    };
  }

  async health() {
    await this.prisma.$queryRaw`SELECT 1`;

    return {
      status: 'ok',
      database: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  async stats() {
    return this.publicStats();
  }

  async publicStats() {
    const [
      activeAudioCount,
      activeCategoryCount,
      activeButtonCount,
      playbackEventCount,
      activePlaybackCount,
      storageBytes,
    ] = await Promise.all([
      this.prisma.audioAsset.count({
        where: { isActive: true },
      }),
      this.prisma.audioCategory.count({
        where: { isActive: true },
      }),
      this.prisma.audioButton.count({
        where: { isActive: true },
      }),
      this.prisma.playbackEvent.count(),
      this.prisma.playbackEvent.count({
        where: {
          stoppedAt: null,
        },
      }),
      this.storageBytes(),
    ]);

    const categoriesWithButtonCounts = await this.prisma.audioCategory.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        buttons: {
          where: {
            isActive: true,
            audioAsset: {
              isActive: true,
            },
          },
          select: {
            id: true,
          },
        },
      },
    });

    return {
      activeAudios: activeAudioCount,
      activeCategories: activeCategoryCount,
      activeButtons: activeButtonCount,
      totalPlaybacks: playbackEventCount,
      activePlaybacks: activePlaybackCount,
      storageBytes,
      storageFormatted: formatBytes(storageBytes),
      byCategory: categoriesWithButtonCounts.map((category) => ({
        id: category.id,
        name: category.name,
        audios: category.buttons.length,
      })),
      timestamp: new Date().toISOString(),
    };
  }

  async storageBytes(): Promise<number> {
    try {
      const storageDriver = this.configService.get<string>('storage.driver');
      const localAudioPath =
        this.configService.get<string>('storage.localAudioPath') ??
        'storage/audio-assets';

      if (storageDriver === 'local' || !storageDriver) {
        const { stat } = await import('fs/promises');
        const { join } = await import('path');
        const path = join(process.cwd(), localAudioPath);

        try {
          const stats = await stat(path);
          if (stats.isFile()) {
            return stats.size;
          }

          const { readdir } = await import('fs/promises');
          const entries = await readdir(path, { withFileTypes: true });

          const sizes = await Promise.all(
            entries.map(async (entry) => {
              const entryPath = join(path, entry.name);
              if (entry.isDirectory()) {
                return directorySize(entryPath);
              }
              if (entry.isFile()) {
                const fileStat = await stat(entryPath);
                return fileStat.size;
              }
              return 0;
            }),
          );

          return sizes.reduce((total, size) => total + size, 0);
        } catch {
          return 0;
        }
      }

      return 0;
    } catch {
      return 0;
    }
  }

  async storageHealth() {
    const backendRoot = process.cwd();
    const projectRoot = resolve(backendRoot, '..');
    const frontendRoot = resolve(projectRoot, 'frontend');
    const audioPath = resolve(
      backendRoot,
      this.configService.get<string>('storage.localAudioPath') ??
        '../storage/audio-assets',
    );
    const localDatabasePath = resolve(projectRoot, '.local-postgres');
    const fileSystem = await statfs(projectRoot);
    const blockSize = Number(fileSystem.bsize);
    const totalBytes = Number(fileSystem.blocks) * blockSize;
    const freeBytes = Number(fileSystem.bavail) * blockSize;
    const usedBytes = totalBytes - freeBytes;

    const [
      backendSourceBytes,
      backendBuildBytes,
      frontendSourceBytes,
      frontendBuildBytes,
      documentsBytes,
      scriptsBytes,
      audioAssetsBytes,
      localDatabaseBytes,
    ] = await Promise.all([
      directorySize(resolve(backendRoot, 'src')),
      directorySize(resolve(backendRoot, 'dist')),
      directorySize(resolve(frontendRoot, 'src')),
      directorySize(resolve(frontendRoot, '.next')),
      directorySize(resolve(projectRoot, 'documentos')),
      directorySize(resolve(projectRoot, 'scripts')),
      directorySize(audioPath),
      directorySize(localDatabasePath),
    ]);

    const appBytes =
      backendSourceBytes +
      backendBuildBytes +
      frontendSourceBytes +
      frontendBuildBytes +
      documentsBytes +
      scriptsBytes;

    return {
      timestamp: new Date().toISOString(),
      filesystem: {
        totalBytes,
        usedBytes,
        freeBytes,
        usedPercent: totalBytes ? Math.round((usedBytes / totalBytes) * 100) : 0,
      },
      usage: {
        appBytes,
        backendSourceBytes,
        backendBuildBytes,
        frontendSourceBytes,
        frontendBuildBytes,
        documentsBytes,
        scriptsBytes,
        audioAssetsBytes,
        localDatabaseBytes,
        trackedBytes: appBytes + audioAssetsBytes + localDatabaseBytes,
      },
      paths: {
        projectRoot,
        backendRoot,
        frontendRoot,
        audioPath,
        localDatabasePath,
      },
    };
  }
}

async function directorySize(path: string): Promise<number> {
  try {
    const entryStat = await stat(path);

    if (!entryStat.isDirectory()) {
      return entryStat.size;
    }

    const entries = await readdir(path, { withFileTypes: true });
    const sizes = await Promise.all(
      entries.map(async (entry) => {
        const entryPath = join(path, entry.name);

        if (entry.isDirectory()) {
          return directorySize(entryPath);
        }

        if (entry.isFile()) {
          const fileStat = await stat(entryPath);
          return fileStat.size;
        }

        return 0;
      }),
    );

    return sizes.reduce((total, size) => total + size, 0);
  } catch {
    return 0;
  }
}
