import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../shared/types/authenticated-user';
import { LocalStorageService } from '../storage/local-storage.service';
import { CreateAudioCategoryDto } from './dto/create-audio-category.dto';
import { UpdateAudioCategoryDto } from './dto/update-audio-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: LocalStorageService,
  ) {}

  list(user: AuthenticatedUser) {
    return this.prisma.audioCategory.findMany({
      where: { organizationId: user.organizationId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { buttons: true } },
      },
    });
  }

  create(user: AuthenticatedUser, dto: CreateAudioCategoryDto) {
    return this.prisma.audioCategory.create({
      data: {
        organizationId: user.organizationId,
        name: dto.name,
        description: dto.description,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateAudioCategoryDto) {
    await this.ensureCategory(user, id);

    return this.prisma.audioCategory.update({
      where: { id },
      data: dto,
    });
  }

  async remove(user: AuthenticatedUser, id: string) {
    const category = await this.prisma.audioCategory.findFirst({
      where: { id, organizationId: user.organizationId },
      include: {
        buttons: {
          select: {
            id: true,
            imageStorageKey: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Audio category not found');
    }

    const imageStorageKeys = category.buttons
      .map((button) => button.imageStorageKey)
      .filter((key): key is string => Boolean(key));
    const buttonIds = category.buttons.map((button) => button.id);

    await this.prisma.$transaction(async (tx) => {
      if (buttonIds.length) {
        await tx.playbackEvent.deleteMany({
          where: {
            audioButtonId: { in: buttonIds },
            organizationId: user.organizationId,
          },
        });

        await tx.audioButton.deleteMany({
          where: {
            id: { in: buttonIds },
            organizationId: user.organizationId,
          },
        });
      }

      await tx.audioCategory.deleteMany({
        where: {
          id,
          organizationId: user.organizationId,
        },
      });
    });

    for (const storageKey of imageStorageKeys) {
      await this.storage.deleteButtonImage(storageKey);
    }

    return { ok: true };
  }

  async reorder(user: AuthenticatedUser, ids: string[]) {
    const categories = await this.prisma.audioCategory.findMany({
      where: {
        organizationId: user.organizationId,
        id: { in: ids },
      },
      select: { id: true },
    });

    const allowed = new Set(categories.map((category) => category.id));
    await this.prisma.$transaction(
      ids
        .filter((id) => allowed.has(id))
        .map((id, index) =>
          this.prisma.audioCategory.update({
            where: { id },
            data: { sortOrder: index },
          }),
        ),
    );

    return { ok: true };
  }

  private async ensureCategory(user: AuthenticatedUser, id: string) {
    const category = await this.prisma.audioCategory.findFirst({
      where: { id, organizationId: user.organizationId },
    });

    if (!category) {
      throw new NotFoundException('Audio category not found');
    }

    return category;
  }
}
