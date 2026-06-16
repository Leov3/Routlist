import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../shared/types/authenticated-user';
import { LocalStorageService } from '../storage/local-storage.service';
import { BulkAudioAssetsDto } from './dto/bulk-audio-assets.dto';
import { UpdateAudioAssetDto } from './dto/update-audio-asset.dto';

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
}
