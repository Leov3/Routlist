import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../shared/types/authenticated-user';
import { LocalStorageService } from '../storage/local-storage.service';
import { CreateAudioButtonDto } from './dto/create-audio-button.dto';
import { UpdateAudioButtonDto } from './dto/update-audio-button.dto';

@Injectable()
export class AudioButtonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: LocalStorageService,
  ) {}

  list(user: AuthenticatedUser) {
    return this.prisma.audioButton.findMany({
      where: { organizationId: user.organizationId },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
      include: {
        category: true,
        audioAsset: {
          select: {
            id: true,
            originalName: true,
            durationSeconds: true,
            mimeType: true,
            transcript: true,
            createdAt: true,
          },
        },
      },
    }).then((buttons) => buttons.map((button) => this.serializeButton(button)));
  }

  findOne(user: AuthenticatedUser, id: string) {
    return this.findSerializableButton(user, id);
  }

  async board(user: AuthenticatedUser) {
    const favorites = await this.prisma.audioButtonFavorite.findMany({
      where: {
        organizationId: user.organizationId,
        userId: user.id,
      },
      select: {
        audioButtonId: true,
      },
    });
    const favoriteIds = new Set(favorites.map((favorite) => favorite.audioButtonId));

    const categories = await this.prisma.audioCategory.findMany({
      where: {
        organizationId: user.organizationId,
        isActive: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        buttons: {
          where: {
            isActive: true,
            audioAsset: { isActive: true },
          },
          orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
          include: {
            category: {
              select: {
                id: true,
                name: true,
              },
            },
            audioAsset: {
              select: {
                id: true,
                originalName: true,
                durationSeconds: true,
                mimeType: true,
                transcript: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    return categories
      .map((category) => ({
        id: category.id,
        name: category.name,
        description: category.description,
        sortOrder: category.sortOrder,
        buttons: category.buttons.map((button) => ({
          id: button.id,
          label: button.label,
          description: button.description,
          color: button.color,
          shortcutKey: button.shortcutKey,
          sortOrder: button.sortOrder,
          audioUrl: `/audio-assets/${button.audioAssetId}/stream`,
          category: {
            id: button.category.id,
            name: button.category.name,
          },
          audioAsset: {
            ...button.audioAsset,
            audioUrl: `/audio-assets/${button.audioAssetId}/stream`,
            audioDownloadUrl: `/audio-assets/${button.audioAssetId}/download`,
          },
          imageUrl: button.imageStorageKey
            ? `/audio-buttons/${button.id}/image`
            : null,
          imageDownloadUrl: button.imageStorageKey
            ? `/audio-buttons/${button.id}/image/download`
            : null,
          isFavorite: favoriteIds.has(button.id),
        })),
      }))
  }

  async toggleFavorite(user: AuthenticatedUser, id: string, favorite: boolean) {
    await this.ensureButton(user, id);

    if (favorite) {
      await this.prisma.audioButtonFavorite.upsert({
        where: {
          organizationId_userId_audioButtonId: {
            organizationId: user.organizationId,
            userId: user.id,
            audioButtonId: id,
          },
        },
        create: {
          organizationId: user.organizationId,
          userId: user.id,
          audioButtonId: id,
        },
        update: {},
      });
      return { ok: true, favorite: true };
    }

    await this.prisma.audioButtonFavorite.deleteMany({
      where: {
        organizationId: user.organizationId,
        userId: user.id,
        audioButtonId: id,
      },
    });

    return { ok: true, favorite: false };
  }

  async duplicate(user: AuthenticatedUser, id: string) {
    const button = await this.prisma.audioButton.findFirst({
      where: { id, organizationId: user.organizationId },
      include: {
        category: true,
        audioAsset: true,
      },
    });

    if (!button) {
      throw new NotFoundException('Audio button not found');
    }

    const maxSortOrder = await this.prisma.audioButton.aggregate({
      where: {
        organizationId: user.organizationId,
        categoryId: button.categoryId,
      },
      _max: { sortOrder: true },
    });

    const duplicated = await this.prisma.audioButton.create({
      data: {
        organizationId: user.organizationId,
        categoryId: button.categoryId,
        audioAssetId: button.audioAssetId,
        label: `${button.label} (copia)`,
        description: button.description,
        color: button.color,
        shortcutKey: button.shortcutKey,
        sortOrder: (maxSortOrder._max.sortOrder ?? button.sortOrder) + 1,
        imageFileName: button.imageFileName,
        imageMimeType: button.imageMimeType,
        imageSizeBytes: button.imageSizeBytes,
        imageStorageKey: button.imageStorageKey,
      },
    });

    return this.findSerializableButton(user, duplicated.id);
  }

  async reorder(user: AuthenticatedUser, ids: string[]) {
    const buttons = await this.prisma.audioButton.findMany({
      where: {
        organizationId: user.organizationId,
        id: { in: ids },
      },
      select: { id: true },
    });

    const allowed = new Set(buttons.map((button) => button.id));
    await this.prisma.$transaction(
      ids
        .filter((id) => allowed.has(id))
        .map((id, index) =>
          this.prisma.audioButton.update({
            where: { id },
            data: { sortOrder: index },
          }),
        ),
    );

    return { ok: true };
  }

  async create(
    user: AuthenticatedUser,
    dto: CreateAudioButtonDto,
    image?: Express.Multer.File,
  ) {
    await this.ensureCategory(user, dto.categoryId);
    await this.ensureAudioAsset(user, dto.audioAssetId);

    const storedImage = image
      ? await this.storage.saveButtonImage(user.organizationId, image)
      : null;

    const button = await this.prisma.audioButton.create({
      data: {
        organizationId: user.organizationId,
        categoryId: dto.categoryId,
        audioAssetId: dto.audioAssetId,
        label: dto.label,
        description: dto.description,
        color: dto.color,
        shortcutKey: dto.shortcutKey,
        sortOrder: dto.sortOrder ?? 0,
        imageFileName: storedImage?.fileName ?? null,
        imageMimeType: storedImage?.mimeType ?? null,
        imageSizeBytes: storedImage?.sizeBytes ?? null,
        imageStorageKey: storedImage?.storageKey ?? null,
        imagePublicUrl: storedImage
          ? `/audio-buttons/${storedImage.storageKey}/image`
          : null,
      },
    });

    return this.findSerializableButton(user, button.id);
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateAudioButtonDto,
    image?: Express.Multer.File,
  ) {
    const existing = await this.ensureButton(user, id);

    if (dto.categoryId) {
      await this.ensureCategory(user, dto.categoryId);
    }

    if (dto.audioAssetId) {
      await this.ensureAudioAsset(user, dto.audioAssetId);
    }

    const storedImage = image
      ? await this.storage.saveButtonImage(user.organizationId, image)
      : null;

    const updated = await this.prisma.audioButton.update({
      where: { id },
      data: dto,
    });

    if (storedImage && existing.imageStorageKey) {
      await this.storage.deleteButtonImage(existing.imageStorageKey);
    }

    if (storedImage) {
      await this.prisma.audioButton.update({
        where: { id },
        data: {
          imageFileName: storedImage.fileName,
          imageMimeType: storedImage.mimeType,
          imageSizeBytes: storedImage.sizeBytes,
          imageStorageKey: storedImage.storageKey,
          imagePublicUrl: `/audio-buttons/${updated.id}/image`,
        },
      });
    }

    return this.findSerializableButton(user, id);
  }

  async remove(user: AuthenticatedUser, id: string) {
    const button = await this.ensureButton(user, id);

    await this.prisma.$transaction(async (tx) => {
      await tx.playbackEvent.deleteMany({
        where: {
          audioButtonId: id,
          organizationId: user.organizationId,
        },
      });

      await tx.audioButton.deleteMany({
        where: {
          id,
          organizationId: user.organizationId,
        },
      });
    });

    if (button.imageStorageKey) {
      await this.storage.deleteButtonImage(button.imageStorageKey);
    }

    return { ok: true };
  }

  async imagePath(user: AuthenticatedUser, id: string) {
    const button = await this.ensureButton(user, id);

    if (!button.imageStorageKey || !button.imageMimeType || !button.imageFileName) {
      throw new NotFoundException('Button image not found');
    }

    return {
      asset: button,
      path: await this.storage.getButtonImagePath(button.imageStorageKey),
    };
  }

  private async ensureButton(user: AuthenticatedUser, id: string) {
    const button = await this.prisma.audioButton.findFirst({
      where: { id, organizationId: user.organizationId },
    });

    if (!button) {
      throw new NotFoundException('Audio button not found');
    }

    return button;
  }

  private async findSerializableButton(user: AuthenticatedUser, id: string) {
    const button = await this.prisma.audioButton.findFirst({
      where: { id, organizationId: user.organizationId },
      include: {
        category: true,
        audioAsset: {
          select: {
            id: true,
            originalName: true,
            durationSeconds: true,
            mimeType: true,
            transcript: true,
            createdAt: true,
          },
        },
      },
    });

    if (!button) {
      throw new NotFoundException('Audio button not found');
    }

    return this.serializeButton(button);
  }

  private serializeButton(button: {
    id: string;
    label: string;
    description: string | null;
    color: string | null;
    shortcutKey: string | null;
    sortOrder: number;
    category: { id: string; name: string };
      audioAsset: {
        id: string;
        originalName: string;
        durationSeconds: number | null;
        mimeType: string;
        transcript: string | null;
        createdAt: Date;
      };
      imageStorageKey: string | null;
      imageFileName?: string | null;
      imageMimeType?: string | null;
      imageSizeBytes?: number | null;
      imagePublicUrl?: string | null;
      isFavorite?: boolean;
  }) {
    return {
      id: button.id,
      label: button.label,
      description: button.description,
      color: button.color,
      shortcutKey: button.shortcutKey,
      sortOrder: button.sortOrder,
      audioUrl: `/audio-assets/${button.audioAsset.id}/stream`,
      category: button.category,
      audioAsset: {
        ...button.audioAsset,
        audioUrl: `/audio-assets/${button.audioAsset.id}/stream`,
        audioDownloadUrl: `/audio-assets/${button.audioAsset.id}/download`,
      },
      imageUrl: button.imageStorageKey
        ? `/audio-buttons/${button.id}/image`
        : null,
      imageDownloadUrl: button.imageStorageKey
        ? `/audio-buttons/${button.id}/image/download`
        : null,
      isFavorite: button.isFavorite ?? false,
    };
  }

  private async ensureCategory(user: AuthenticatedUser, id: string) {
    const category = await this.prisma.audioCategory.findFirst({
      where: { id, organizationId: user.organizationId },
    });

    if (!category) {
      throw new NotFoundException('Audio category not found');
    }
  }

  private async ensureAudioAsset(user: AuthenticatedUser, id: string) {
    const asset = await this.prisma.audioAsset.findFirst({
      where: { id, organizationId: user.organizationId },
    });

    if (!asset) {
      throw new NotFoundException('Audio asset not found');
    }
  }
}
