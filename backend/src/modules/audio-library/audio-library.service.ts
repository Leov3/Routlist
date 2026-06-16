import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../shared/types/authenticated-user';
import { LocalStorageService } from '../storage/local-storage.service';
import { BulkAudioAssetsDto } from './dto/bulk-audio-assets.dto';
import { UpdateAudioAssetDto } from './dto/update-audio-asset.dto';

type CsvAudioRow = {
  rowNumber: number;
  fileName: string;
  path: string | null;
  text: string;
  label: string | null;
  buttonTitle: string | null;
  description: string | null;
  tag: string | null;
};

@Injectable()
export class AudioLibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: LocalStorageService,
  ) {}

  list(user: AuthenticatedUser) {
    return this.prisma.audioAsset.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
        durationSeconds: true,
        storageDriver: true,
        transcript: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        createdBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });
  }

  async create(user: AuthenticatedUser, file: Express.Multer.File) {
    const stored = await this.storage.saveAudio(user.organizationId, file, 'audio-persisted');

    return this.prisma.audioAsset.create({
      data: {
        organizationId: user.organizationId,
        fileName: stored.fileName,
        originalName: stored.originalName,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
        storageDriver: stored.storageDriver,
        storageKey: stored.storageKey,
        createdById: user.id,
        transcript: null,
      },
      select: {
        id: true,
        fileName: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
        storageDriver: true,
        storageKey: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async importCsv(
    user: AuthenticatedUser,
    csvFile: Express.Multer.File | undefined,
    audioFiles: Express.Multer.File[],
    pathsJson?: string,
  ) {
    if (!csvFile) {
      throw new NotFoundException('CSV file is required');
    }

    if (!audioFiles.length) {
      throw new NotFoundException('Audio files are required');
    }

    const rows = this.parseCsvAudioRows(csvFile.buffer.toString('utf8'));
    const pathHints = this.parsePathHints(pathsJson, audioFiles.length);
    const filesByKey = new Map<string, Express.Multer.File>();
    const pathFileKeyMap = new Map<string, Express.Multer.File>();
    const duplicates: string[] = [];

    audioFiles.forEach((file, index) => {
      const hintedPath = pathHints[index] ?? '';
      const pathKey = this.fileMatchKey(hintedPath || file.originalname);
      if (!pathFileKeyMap.has(pathKey)) {
        pathFileKeyMap.set(pathKey, file);
      }
    });

    for (const file of audioFiles) {
      const key = this.fileMatchKey(file.originalname);
      if (filesByKey.has(key)) {
        duplicates.push(file.originalname);
        continue;
      }
      filesByKey.set(key, file);
    }

    const created: Array<{ id: string; fileName: string; originalName: string; mimeType: string; sizeBytes: number; storageDriver: string; storageKey: string; isActive: boolean; createdAt: Date }> = [];
    const matchedRows: Array<CsvAudioRow & { matchedFile: string; status: 'MATCHED' | 'DUPLICATE' | 'MISSING_FILE' }> = [];
    const unmatchedFiles: string[] = [];
    const usedFiles = new Set<string>();

    for (const row of rows) {
      const matchedFile = this.resolveCsvFile(filesByKey, pathFileKeyMap, row);
      if (!matchedFile) {
        matchedRows.push({ ...row, matchedFile: '', status: 'MISSING_FILE' });
        continue;
      }

      const matchKey = this.fileMatchKey(matchedFile.originalname);
      if (usedFiles.has(matchKey)) {
        matchedRows.push({ ...row, matchedFile: matchedFile.originalname, status: 'DUPLICATE' });
        continue;
      }
      usedFiles.add(matchKey);

      const stored = await this.storage.saveAudio(user.organizationId, matchedFile, 'audio-persisted');
      const asset = await this.prisma.audioAsset.create({
        data: {
          organizationId: user.organizationId,
          fileName: stored.fileName,
          originalName: row.buttonTitle?.trim() || row.label?.trim() || stored.originalName,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          storageDriver: stored.storageDriver,
          storageKey: stored.storageKey,
          createdById: user.id,
          transcript: row.text,
          generatedText: row.text,
          importMetadata: {
            csvRowNumber: row.rowNumber,
            csvFileName: row.fileName,
            csvPath: row.path,
            label: row.label,
            buttonTitle: row.buttonTitle,
            description: row.description,
            tag: row.tag,
          },
        },
        select: {
          id: true,
          fileName: true,
          originalName: true,
          mimeType: true,
          sizeBytes: true,
          storageDriver: true,
          storageKey: true,
          isActive: true,
          createdAt: true,
        },
      });

      created.push(asset);
      matchedRows.push({ ...row, matchedFile: matchedFile.originalname, status: 'MATCHED' });
    }

    for (const file of audioFiles) {
      const key = this.fileMatchKey(file.originalname);
      if (!usedFiles.has(key)) {
        unmatchedFiles.push(file.originalname);
      }
    }

    return {
      createdCount: created.length,
      skippedCount: rows.length - created.length,
      duplicates,
      unmatchedFiles,
      rows: matchedRows,
      assets: created,
    };
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const asset = await this.prisma.audioAsset.findFirst({
      where: { id, organizationId: user.organizationId },
      include: {
        createdBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    if (!asset) {
      throw new NotFoundException('Audio asset not found');
    }

    return asset;
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateAudioAssetDto) {
    await this.ensureAsset(user, id);

    return this.prisma.audioAsset.update({
      where: { id },
      data: dto,
    });
  }

  async remove(user: AuthenticatedUser, id: string) {
    const asset = await this.prisma.audioAsset.findFirst({
      where: { id, organizationId: user.organizationId },
      select: {
        id: true,
        storageKey: true,
        buttons: {
          select: {
            id: true,
            imageStorageKey: true,
          },
        },
      },
    });

    if (!asset) {
      throw new NotFoundException('Audio asset not found');
    }

    const buttonIds = asset.buttons.map((button) => button.id);
    const imageStorageKeys = asset.buttons
      .map((button) => button.imageStorageKey)
      .filter((key): key is string => Boolean(key));

    await this.prisma.$transaction(async (tx) => {
      await tx.playbackEvent.deleteMany({
        where: {
          organizationId: user.organizationId,
          OR: [
            { audioAssetId: id },
            ...(buttonIds.length ? [{ audioButtonId: { in: buttonIds } }] : []),
          ],
        },
      });

      if (buttonIds.length) {
        await tx.audioButton.deleteMany({
          where: {
            id: { in: buttonIds },
            organizationId: user.organizationId,
          },
        });
      }

      await tx.audioAsset.deleteMany({
        where: {
          id,
          organizationId: user.organizationId,
        },
      });
    });

    await this.storage.deleteAudio(asset.storageKey);
    for (const storageKey of imageStorageKeys) {
      await this.storage.deleteButtonImage(storageKey);
    }

    return { ok: true };
  }

  async bulk(
    user: AuthenticatedUser,
    dto: BulkAudioAssetsDto,
    files?: Express.Multer.File[],
  ) {
    if (dto.action === 'IMPORT') {
      if (!files?.length) {
        throw new NotFoundException('Audio files are required');
      }

      const created: Array<{
        id: string;
        fileName: string;
        originalName: string;
        mimeType: string;
        sizeBytes: number;
        storageDriver: string;
        storageKey: string;
        isActive: boolean;
        createdAt: Date;
      }> = [];

      for (const file of files) {
        const stored = await this.storage.saveAudio(user.organizationId, file, 'audio-persisted');
        const asset = await this.prisma.audioAsset.create({
          data: {
            organizationId: user.organizationId,
            fileName: stored.fileName,
            originalName: stored.originalName,
            mimeType: stored.mimeType,
            sizeBytes: stored.sizeBytes,
            storageDriver: stored.storageDriver,
            storageKey: stored.storageKey,
            createdById: user.id,
          },
          select: {
            id: true,
            fileName: true,
            originalName: true,
            mimeType: true,
            sizeBytes: true,
            storageDriver: true,
            storageKey: true,
            isActive: true,
            createdAt: true,
          },
        });

        created.push(asset);
      }

      return { count: created.length, ids: created.map((asset) => asset.id), assets: created };
    }

    if (!dto.ids?.length) {
      return { count: 0, ids: [] };
    }

    const assets = await this.prisma.audioAsset.findMany({
      where: {
        id: { in: dto.ids },
        organizationId: user.organizationId,
      },
      select: {
        id: true,
        storageKey: true,
        buttons: {
          select: {
            id: true,
            imageStorageKey: true,
          },
        },
      },
    });
    const ids = assets.map((asset) => asset.id);

    if (!ids.length) {
      return { count: 0, ids: [] };
    }

    if (dto.action === 'ACTIVATE') {
      const result = await this.prisma.audioAsset.updateMany({
        where: { id: { in: ids }, organizationId: user.organizationId },
        data: { isActive: true },
      });

      return { count: result.count, ids };
    }

    const assetIds = assets.map((asset) => asset.id);
    const buttonIds = assets.flatMap((asset) => asset.buttons.map((button) => button.id));
    const audioStorageKeys = assets.map((asset) => asset.storageKey);
    const imageStorageKeys = assets
      .flatMap((asset) => asset.buttons.map((button) => button.imageStorageKey))
      .filter((key): key is string => Boolean(key));

    await this.prisma.$transaction(async (tx) => {
      await tx.playbackEvent.deleteMany({
        where: {
          organizationId: user.organizationId,
          OR: [
            { audioAssetId: { in: assetIds } },
            ...(buttonIds.length ? [{ audioButtonId: { in: buttonIds } }] : []),
          ],
        },
      });

      if (buttonIds.length) {
        await tx.audioButton.deleteMany({
          where: {
            id: { in: buttonIds },
            organizationId: user.organizationId,
          },
        });
      }

      await tx.audioAsset.deleteMany({
        where: {
          id: { in: assetIds },
          organizationId: user.organizationId,
        },
      });
    });

    for (const storageKey of audioStorageKeys) {
      await this.storage.deleteAudio(storageKey);
    }

    for (const storageKey of imageStorageKeys) {
      await this.storage.deleteButtonImage(storageKey);
    }

    return { count: assetIds.length, ids: assetIds };
  }

  async streamPath(user: AuthenticatedUser, id: string) {
    const asset = await this.ensureAsset(user, id, true);
    return {
      asset,
      path: await this.storage.getAudioPath(asset.storageKey),
    };
  }

  async downloadPath(user: AuthenticatedUser, id: string) {
    const asset = await this.ensureAsset(user, id);
    return {
      asset,
      path: await this.storage.getAudioPath(asset.storageKey),
    };
  }

  private async ensureAsset(
    user: AuthenticatedUser,
    id: string,
    activeOnly = false,
  ) {
    const asset = await this.prisma.audioAsset.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
        ...(activeOnly ? { isActive: true } : {}),
      },
    });

    if (!asset) {
      throw new NotFoundException('Audio asset not found');
    }

    return asset;
  }

  private parseCsvAudioRows(csvText: string): CsvAudioRow[] {
    const lines = csvText
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) {
      throw new NotFoundException('CSV file is empty');
    }

    const headers = this.parseCsvLine(lines[0]).map((header) => header.trim());
    const indexOf = (name: string) => headers.findIndex((header) => header.toLowerCase() === name.toLowerCase());
    const fileNameIndex = indexOf('file_name');
    const textIndex = indexOf('text');
    const labelIndex = indexOf('label');
    const buttonTitleIndex = indexOf('button_title');
    const descriptionIndex = indexOf('description');
    const tagIndex = indexOf('tag');
    const pathIndex = indexOf('path');

    if (fileNameIndex === -1 || textIndex === -1) {
      throw new NotFoundException('CSV must include file_name and text columns');
    }

    return lines.slice(1).map((line, rowIndex) => {
      const values = this.parseCsvLine(line);
      const get = (index: number) => (index >= 0 ? values[index]?.trim() ?? '' : '');

      return {
        rowNumber: rowIndex + 2,
        fileName: get(fileNameIndex),
        path: pathIndex >= 0 ? get(pathIndex) || null : null,
        text: get(textIndex),
        label: labelIndex >= 0 ? get(labelIndex) || null : null,
        buttonTitle: buttonTitleIndex >= 0 ? get(buttonTitleIndex) || null : null,
        description: descriptionIndex >= 0 ? get(descriptionIndex) || null : null,
        tag: tagIndex >= 0 ? get(tagIndex) || null : null,
      };
    });
  }

  private parseCsvLine(line: string) {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const next = line[index + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === ',' && !inQuotes) {
        cells.push(current);
        current = '';
        continue;
      }

      current += char;
    }

    cells.push(current);
    return cells;
  }

  private fileMatchKey(value: string) {
    return value.trim().toLowerCase();
  }

  private resolveCsvFile(
    filesByKey: Map<string, Express.Multer.File>,
    pathFileKeyMap: Map<string, Express.Multer.File>,
    row: CsvAudioRow,
  ) {
    const pathKey = row.path ? this.fileMatchKey(`${row.path}/${row.fileName}`) : null;
    if (pathKey && pathFileKeyMap.has(pathKey)) {
      return pathFileKeyMap.get(pathKey) ?? null;
    }

    const fileNameKey = this.fileMatchKey(row.fileName);
    return filesByKey.get(fileNameKey) ?? null;
  }

  private parsePathHints(pathsJson: string | undefined, expectedCount: number) {
    if (!pathsJson) {
      return [];
    }

    try {
      const parsed = JSON.parse(pathsJson) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .slice(0, expectedCount)
        .map((value) => (typeof value === 'string' ? value.trim() : ''));
    } catch {
      return [];
    }
  }
}
