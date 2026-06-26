import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { randomUUID } from 'crypto';
import { mkdir, rename, stat, unlink, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { promisify } from 'util';
import {
  ALLOWED_AUDIO_MIME_TYPES,
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_AUDIO_SIZE_BYTES,
  MAX_IMAGE_SIZE_BYTES,
  StorageAssetKind,
  StoredFile,
  StoredImage,
} from './storage.types';

@Injectable()
export class LocalStorageService {
  constructor(private readonly configService: ConfigService) {}
  private readonly execFileAsync = promisify(execFile);

  async saveAudio(
    organizationId: string,
    file: Express.Multer.File,
    kind: StorageAssetKind = 'audio-persisted',
  ): Promise<StoredFile> {
    if (!file) {
      throw new BadRequestException('Audio file is required');
    }

    if (!ALLOWED_AUDIO_MIME_TYPES.includes(file.mimetype as never)) {
      throw new BadRequestException('Unsupported audio format');
    }

    if (file.size > MAX_AUDIO_SIZE_BYTES) {
      throw new BadRequestException('Audio file exceeds 20 MB limit');
    }

    const audioId = randomUUID();
    const extension = this.extensionFor(file);
    const fileName = `${audioId}${extension}`;
    const rootPath = this.configService.getOrThrow<string>('storage.localAudioPath');
    const storageFolder = this.storageFolderFor(kind);
    const organizationPath = join(rootPath, organizationId, storageFolder);
    const storageKey = `${organizationId}/${storageFolder}/${fileName}`;
    const absolutePath = join(organizationPath, fileName);

    await mkdir(organizationPath, { recursive: true });
    await writeFile(absolutePath, file.buffer);
    await this.normalizeAudioFile(absolutePath, file.mimetype);
    const finalStat = await stat(absolutePath);

    return {
      storageDriver: 'local',
      storageKey,
      fileName,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: finalStat.size,
      absolutePath,
    };
  }

  async saveButtonImage(
    organizationId: string,
    file: Express.Multer.File,
  ): Promise<StoredImage> {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype as never)) {
      throw new BadRequestException('Unsupported image format');
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      throw new BadRequestException('Image file exceeds 5 MB limit');
    }

    const imageId = randomUUID();
    const extension = this.extensionFor(file);
    const fileName = `${imageId}${extension}`;
    const storageKey = `${organizationId}/${fileName}`;
    const rootPath =
      this.configService.getOrThrow<string>('storage.localStoragePath');
    const imageRootPath = join(rootPath, 'button-images');
    const organizationPath = join(imageRootPath, organizationId);
    const absolutePath = join(organizationPath, fileName);

    await mkdir(organizationPath, { recursive: true });
    await writeFile(absolutePath, file.buffer);

    return {
      storageDriver: 'local',
      storageKey,
      fileName,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      absolutePath,
    };
  }

  async getAudioPath(storageKey: string): Promise<string> {
    const rootPath = this.configService.getOrThrow<string>('storage.localAudioPath');
    const candidates = this.audioCandidates(rootPath, storageKey);

    for (const absolutePath of candidates) {
      try {
        await stat(absolutePath);
        return absolutePath;
      } catch {
        continue;
      }
    }

    throw new NotFoundException('Audio file not found');
  }

  async getButtonImagePath(storageKey: string): Promise<string> {
    const rootPath = this.configService.getOrThrow<string>('storage.localStoragePath');
    const absolutePath = join(rootPath, 'button-images', storageKey);

    try {
      await stat(absolutePath);
      return absolutePath;
    } catch {
      throw new NotFoundException('Button image not found');
    }
  }

  async deleteAudio(storageKey: string): Promise<void> {
    const rootPath = this.configService.getOrThrow<string>('storage.localAudioPath');
    for (const absolutePath of this.audioCandidates(rootPath, storageKey)) {
      try {
        await unlink(absolutePath);
        return;
      } catch {
        continue;
      }
    }
  }

  async saveVideo(
    organizationId: string,
    file: Express.Multer.File,
    kind: StorageAssetKind = 'video-persisted',
  ): Promise<StoredFile> {
    return this.saveAudio(organizationId, file, kind);
  }

  private storageFolderFor(kind: StorageAssetKind) {
    switch (kind) {
      case 'audio-temporary':
        return 'audio/temporary';
      case 'audio-persisted':
        return 'audio/persisted';
      case 'video-temporary':
        return 'video/temporary';
      case 'video-persisted':
        return 'video/persisted';
    }
  }

  private audioCandidates(rootPath: string, storageKey: string) {
    const normalizedKey = storageKey.replace(/^\/+/, '');
    const trimmedRoot = rootPath.replace(/\/+$/, '');

    return [
      join(trimmedRoot, normalizedKey),
      join(trimmedRoot, ...normalizedKey.split('/')),
      join(trimmedRoot, 'audio-assets', normalizedKey),
      join(trimmedRoot, 'audio-assets', ...normalizedKey.split('/')),
    ];
  }

  async deleteButtonImage(storageKey: string): Promise<void> {
    const rootPath = this.configService.getOrThrow<string>('storage.localStoragePath');
    const absolutePath = join(rootPath, 'button-images', storageKey);

    try {
      await unlink(absolutePath);
    } catch {
      return;
    }
  }

  private extensionFor(file: Express.Multer.File) {
    const originalExtension = extname(file.originalname);

    if (originalExtension) {
      return originalExtension.toLowerCase();
    }

    if (file.mimetype.includes('wav')) {
      return '.wav';
    }

    return '.mp3';
  }

  private async normalizeAudioFile(
    absolutePath: string,
    mimeType: string,
  ): Promise<void> {
    const tempPath = `${absolutePath}.normalized${extname(absolutePath)}`;
    const audioFilter = 'loudnorm=I=-16:TP=-1.5:LRA=11';
    const codecArgs =
      mimeType.includes('wav')
        ? ['-c:a', 'pcm_s16le']
        : ['-c:a', 'libmp3lame', '-q:a', '2'];

    try {
      await this.execFileAsync('ffmpeg', [
        '-y',
        '-i',
        absolutePath,
        '-af',
        audioFilter,
        ...codecArgs,
        tempPath,
      ]);

      await rename(tempPath, absolutePath);
    } catch {
      await unlink(tempPath).catch(() => undefined);
    }
  }
}
