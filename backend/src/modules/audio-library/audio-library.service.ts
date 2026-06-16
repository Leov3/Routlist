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

type CsvAudioMatchStatus = 'MATCHED' | 'DUPLICATE' | 'MISSING_FILE' | 'CREATE_FAILED';

type CsvAudioPreviewRow = CsvAudioRow & {
  id: string;
  originalName: string;
  matchedFile: string | null;
  matchedFileName: string | null;
  status: CsvAudioMatchStatus;
  mimeType: string | null;
  sizeBytes: number | null;
  assetId: string | null;
  errorMessage: string | null;
};

type CsvAudioMatch = {
  row: CsvAudioRow;
  file: Express.Multer.File;
  matchKey: string;
};

type CreatedCsvAudioAsset = {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storageDriver: string;
  storageKey: string;
  durationSeconds: number | null;
  transcript: string | null;
  generatedText: string | null;
  importMetadata: unknown;
  isActive: boolean;
  createdAt: Date;
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
    return this.previewCsvImport(csvFile, audioFiles, pathsJson, user.organizationId, {
      persist: true,
      createdById: user.id,
    });
  }

  previewCsv(
    csvFile: Express.Multer.File | undefined,
    audioFiles: Express.Multer.File[],
    pathsJson?: string,
  ) {
    return this.previewCsvImport(csvFile, audioFiles, pathsJson, null, {
      persist: false,
    });
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

  private normalizeCsvPath(value: string | null | undefined) {
    return (value ?? '')
      .replace(/\\/g, '/')
      .split('/')
      .map((part) => part.trim())
      .filter(Boolean)
      .join('/')
      .toLowerCase();
  }

  private fileMatchKey(value: string | null | undefined) {
    return this.normalizeCsvPath(value);
  }

  private csvBasename(value: string | null | undefined) {
    const normalized = this.normalizeCsvPath(value);
    if (!normalized) {
      return '';
    }
    return normalized.split('/').pop() ?? '';
  }

  private csvDirname(value: string | null | undefined) {
    const normalized = this.normalizeCsvPath(value);
    const index = normalized.lastIndexOf('/');
    return index > 0 ? normalized.slice(0, index) : '';
  }

  private addCsvFileKey(
    target: Map<string, Express.Multer.File>,
    value: string | null | undefined,
    file: Express.Multer.File,
  ) {
    const key = this.fileMatchKey(value);
    if (key && !target.has(key)) {
      target.set(key, file);
    }
  }

  private addCsvFileSuffixKeys(
    target: Map<string, Express.Multer.File>,
    value: string | null | undefined,
    file: Express.Multer.File,
  ) {
    const normalized = this.fileMatchKey(value);
    if (!normalized) {
      return;
    }

    const parts = normalized.split('/');
    for (let index = 0; index < parts.length; index += 1) {
      this.addCsvFileKey(target, parts.slice(index).join('/'), file);
    }
  }

  private resolveCsvFile(
    filesByKey: Map<string, Express.Multer.File>,
    pathFileKeyMap: Map<string, Express.Multer.File>,
    row: CsvAudioRow,
  ) {
    const candidates: string[] = [];

    if (row.path) {
      candidates.push(`${row.path}/${row.fileName}`);
      candidates.push(row.path);
      const pathDirname = this.csvDirname(row.path);
      if (pathDirname) {
        candidates.push(`${pathDirname}/${row.fileName}`);
      }
    }

    candidates.push(row.fileName);
    candidates.push(this.csvBasename(row.fileName));

    for (const candidate of candidates) {
      const pathKey = this.fileMatchKey(candidate);
      const byPath = pathFileKeyMap.get(pathKey);
      if (byPath) {
        return byPath;
      }
    }

    const fileNameKey = this.fileMatchKey(row.fileName);
    return filesByKey.get(fileNameKey) ?? filesByKey.get(this.csvBasename(row.fileName)) ?? null;
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

  private buildCsvFileIndexes(audioFiles: Express.Multer.File[], pathsJson?: string) {
    const pathHints = this.parsePathHints(pathsJson, audioFiles.length);
    const filesByKey = new Map<string, Express.Multer.File>();
    const pathFileKeyMap = new Map<string, Express.Multer.File>();
    const duplicates: string[] = [];

    audioFiles.forEach((file, index) => {
      const hintedPath = pathHints[index] ?? '';
      const effectivePath = hintedPath || file.originalname;
      this.addCsvFileSuffixKeys(pathFileKeyMap, effectivePath, file);
      this.addCsvFileKey(pathFileKeyMap, this.csvBasename(effectivePath), file);
      this.addCsvFileKey(pathFileKeyMap, file.originalname, file);

      const hintedDirname = this.csvDirname(effectivePath);
      if (hintedDirname) {
        this.addCsvFileKey(pathFileKeyMap, `${hintedDirname}/${file.originalname}`, file);
      }
    });

    for (const file of audioFiles) {
      const key = this.fileMatchKey(file.originalname);
      if (filesByKey.has(key)) {
        duplicates.push(file.originalname);
        continue;
      }
      filesByKey.set(key, file);
      this.addCsvFileKey(filesByKey, this.csvBasename(file.originalname), file);
    }

    return { filesByKey, pathFileKeyMap, duplicates };
  }

  private previewCsvImport(
    csvFile: Express.Multer.File | undefined,
    audioFiles: Express.Multer.File[],
    pathsJson: string | undefined,
    organizationId: string | null,
    options: { persist: boolean; createdById?: string } = { persist: false },
  ) {
    if (!csvFile) {
      throw new NotFoundException('CSV file is required');
    }

    if (!audioFiles.length) {
      throw new NotFoundException('Audio files are required');
    }

    const rows = this.parseCsvAudioRows(csvFile.buffer.toString('utf8'));
    const { filesByKey, pathFileKeyMap, duplicates } = this.buildCsvFileIndexes(audioFiles, pathsJson);
    const previewRows: CsvAudioPreviewRow[] = [];
    const matches: CsvAudioMatch[] = [];
    const usedFiles = new Set<Express.Multer.File>();

    for (const row of rows) {
      const matchedFile = this.resolveCsvFile(filesByKey, pathFileKeyMap, row);
      if (!matchedFile) {
        previewRows.push(this.createCsvQueueItem(row, null, 'MISSING_FILE', 'No se encontro un archivo para esta fila.'));
        continue;
      }

      if (usedFiles.has(matchedFile)) {
        previewRows.push(this.createCsvQueueItem(row, matchedFile, 'DUPLICATE', 'Este archivo ya fue usado por otra fila del CSV.'));
        continue;
      }

      usedFiles.add(matchedFile);
      previewRows.push(this.createCsvQueueItem(row, matchedFile, 'MATCHED'));
      matches.push({ row, file: matchedFile, matchKey: this.fileMatchKey(matchedFile.originalname) });
    }

    const unmatchedFiles = audioFiles
      .filter((file) => !usedFiles.has(file))
      .map((file) => file.originalname);

    if (!options.persist) {
      return {
        createdCount: 0,
        skippedCount: previewRows.filter((row) => row.status !== 'MATCHED').length,
        duplicates,
        unmatchedFiles,
        rows: previewRows,
        assets: [],
        queue: previewRows,
      };
    }

    if (!organizationId || !options.createdById) {
      throw new NotFoundException('Missing persistence context');
    }

    return this.persistCsvMatches(
      organizationId,
      options.createdById,
      matches,
      previewRows,
      duplicates,
      unmatchedFiles,
    );
  }

  private async persistCsvMatches(
    organizationId: string,
    createdById: string,
    matches: CsvAudioMatch[],
    previewRows: CsvAudioPreviewRow[],
    duplicates: string[],
    unmatchedFiles: string[],
  ) {
    const created: CreatedCsvAudioAsset[] = [];
    const queueByRowNumber = new Map(previewRows.map((row) => [row.rowNumber, row]));

    for (const match of matches) {
      try {
        const stored = await this.storage.saveAudio(organizationId, match.file, 'audio-persisted');
        const asset = await this.prisma.audioAsset.create({
          data: {
            organizationId,
            fileName: stored.fileName,
            originalName: match.row.text?.trim() || stored.originalName,
            mimeType: stored.mimeType,
            sizeBytes: stored.sizeBytes,
            storageDriver: stored.storageDriver,
            storageKey: stored.storageKey,
            createdById,
            transcript: match.row.text,
            generatedText: match.row.text,
            importMetadata: {
              csvRowNumber: match.row.rowNumber,
              csvFileName: match.row.fileName,
              csvPath: match.row.path,
              label: match.row.label,
              buttonTitle: match.row.buttonTitle,
              description: match.row.description,
              tag: match.row.tag,
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
            durationSeconds: true,
            transcript: true,
            generatedText: true,
            importMetadata: true,
            isActive: true,
            createdAt: true,
          },
        });

        created.push(asset);
        const queueItem = queueByRowNumber.get(match.row.rowNumber);
        if (queueItem) {
          queueItem.assetId = asset.id;
          queueItem.fileName = asset.fileName;
          queueItem.mimeType = asset.mimeType;
          queueItem.sizeBytes = asset.sizeBytes;
        }
      } catch (error) {
        const queueItem = queueByRowNumber.get(match.row.rowNumber);
        if (queueItem) {
          queueItem.status = 'CREATE_FAILED';
          queueItem.errorMessage = error instanceof Error ? error.message : 'No se pudo crear el audio.';
        }
      }
    }

    return {
      createdCount: created.length,
      skippedCount: previewRows.filter((row) => row.status !== 'MATCHED' || !row.assetId).length,
      duplicates,
      unmatchedFiles,
      rows: previewRows,
      assets: created,
      queue: previewRows,
    };
  }

  private createCsvQueueItem(
    row: CsvAudioRow,
    file: Express.Multer.File | null,
    status: CsvAudioMatchStatus,
    errorMessage: string | null = null,
  ): CsvAudioPreviewRow {
    const originalName = row.text?.trim() || row.fileName;
    const matchedFileName = file?.originalname ?? null;

    return {
      ...row,
      id: `csv-row-${row.rowNumber}`,
      originalName,
      matchedFile: matchedFileName,
      matchedFileName,
      status,
      mimeType: file?.mimetype ?? null,
      sizeBytes: typeof file?.size === 'number' ? file.size : null,
      assetId: null,
      errorMessage,
    };
  }
}
