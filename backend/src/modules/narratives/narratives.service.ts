import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type NarrativeStatus, type NarrativeVersionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../shared/types/authenticated-user';
import { CreateNarrativeDto } from './dto/create-narrative.dto';
import { PublishNarrativeDto } from './dto/publish-narrative.dto';
import { SaveNarrativeGraphDto } from './dto/save-narrative-graph.dto';
import { UpdateNarrativeDto } from './dto/update-narrative.dto';
import {
  cloneGraphJson,
  emptyGraphJson,
  validateNarrativeGraph,
} from './narrative-graph';
import type { NarrativeGraphJson } from './narratives.types';

const DRAFT_STATUS: NarrativeVersionStatus = 'DRAFT';
const PUBLISHED_STATUS: NarrativeVersionStatus = 'PUBLISHED';
const ARCHIVED_STATUS: NarrativeStatus = 'ARCHIVED';
const ACTIVE_STATUS: NarrativeStatus = 'ACTIVE';
const DRAFT_NARRATIVE_STATUS: NarrativeStatus = 'DRAFT';
const ARCHIVED_VERSION_STATUS: NarrativeVersionStatus = 'ARCHIVED';

@Injectable()
export class NarrativesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthenticatedUser) {
    return this.prisma.narrative.findMany({
      where: { organizationId: user.organizationId },
      orderBy: [{ createdAt: 'desc' }],
      include: {
        _count: {
          select: {
            versions: true,
            runs: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        updatedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        publishedVersion: {
          select: {
            id: true,
            versionNumber: true,
            status: true,
            publishedAt: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async active(user: AuthenticatedUser) {
    return this.prisma.narrative.findMany({
      where: {
        organizationId: user.organizationId,
        status: ACTIVE_STATUS,
      },
      orderBy: [{ updatedAt: 'desc' }],
      include: {
        publishedVersion: {
          select: {
            id: true,
            versionNumber: true,
            status: true,
            publishedAt: true,
          },
        },
      },
    });
  }

  async findOne(user: AuthenticatedUser, id: string) {
    return this.getNarrativeOrThrow(user, id);
  }

  async create(user: AuthenticatedUser, dto: CreateNarrativeDto) {
    const title = dto.title.trim();
    const description = dto.description?.trim() || null;

    return this.prisma.$transaction(async (tx) => {
      const narrative = await tx.narrative.create({
        data: {
          organizationId: user.organizationId,
          title,
          description,
          status: DRAFT_NARRATIVE_STATUS,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
      });

      const version = await tx.narrativeVersion.create({
        data: {
          narrativeId: narrative.id,
          versionNumber: 1,
          status: DRAFT_STATUS,
          graphJson: emptyGraphJson() as Prisma.InputJsonValue,
        },
      });

      return { ...narrative, currentDraftVersion: version };
    });
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateNarrativeDto) {
    await this.getNarrativeOrThrow(user, id);

    const data: {
      title?: string;
      description?: string | null;
      updatedByUserId: string;
    } = {
      updatedByUserId: user.id,
    };

    if (dto.title) {
      data.title = dto.title.trim();
    }

    if (dto.description !== undefined) {
      data.description = dto.description?.trim() || null;
    }

    return this.prisma.narrative.update({
      where: { id },
      data,
    });
  }

  async archive(user: AuthenticatedUser, id: string) {
    const narrative = await this.getNarrativeOrThrow(user, id);

    await this.prisma.$transaction(async (tx) => {
      await tx.narrative.update({
        where: { id: narrative.id },
        data: {
          status: ARCHIVED_STATUS,
          updatedByUserId: user.id,
        },
      });

      await tx.narrativeVersion.updateMany({
        where: {
          narrativeId: narrative.id,
          status: DRAFT_STATUS,
        },
        data: {
          status: ARCHIVED_VERSION_STATUS,
        },
      });
    });

    return this.getNarrativeOrThrow(user, id);
  }

  async duplicate(user: AuthenticatedUser, id: string) {
    const narrative = await this.getNarrativeOrThrow(user, id);
    const sourceVersion = await this.getEditableVersion(narrative.id, false);
    const sourceGraph = cloneGraphJson(
      (sourceVersion?.graphJson ??
        narrative.publishedVersion?.graphJson ??
        emptyGraphJson()) as NarrativeGraphJson,
    );

    return this.prisma.$transaction(async (tx) => {
      const copy = await tx.narrative.create({
        data: {
          organizationId: user.organizationId,
          title: `${narrative.title} (copia)`,
          description: narrative.description,
          status: DRAFT_NARRATIVE_STATUS,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
      });

      const version = await tx.narrativeVersion.create({
        data: {
          narrativeId: copy.id,
          versionNumber: 1,
          status: DRAFT_STATUS,
          graphJson: sourceGraph as Prisma.InputJsonValue,
        },
      });

      return { ...copy, currentDraftVersion: version };
    });
  }

  async getBuilderState(user: AuthenticatedUser, id: string) {
    const narrative = await this.getNarrativeOrThrow(user, id);
    const draftVersion = await this.getEditableVersion(narrative.id, true);
    const publishedVersion = narrative.publishedVersionId
      ? await this.prisma.narrativeVersion.findFirst({
          where: {
            id: narrative.publishedVersionId,
            narrativeId: narrative.id,
          },
        })
      : null;

    const validation = validateNarrativeGraph(draftVersion?.graphJson ?? emptyGraphJson(), { strict: true });

    return {
      narrative,
      draftVersion,
      publishedVersion,
      validation,
    };
  }

  async saveGraph(
    user: AuthenticatedUser,
    id: string,
    dto: SaveNarrativeGraphDto,
  ) {
    const narrative = await this.getNarrativeOrThrow(user, id);
    const validation = validateNarrativeGraph(dto.graphJson, { strict: false });

    if (!validation.valid) {
      throw new BadRequestException(validation.errors);
    }

    const draftVersion = await this.getEditableVersion(narrative.id, true);

    if (!draftVersion) {
      throw new NotFoundException('Editable narrative version not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedVersion = await tx.narrativeVersion.update({
        where: { id: draftVersion.id },
        data: {
          graphJson: dto.graphJson as Prisma.InputJsonValue,
        },
      });

      const updatedNarrative = await tx.narrative.update({
        where: { id: narrative.id },
        data: {
          updatedByUserId: user.id,
        },
      });

      return {
        narrative: updatedNarrative,
        draftVersion: updatedVersion,
      };
    });
  }

  async validate(user: AuthenticatedUser, id: string, graphJson?: Record<string, unknown>) {
    await this.getNarrativeOrThrow(user, id);

    const payload = graphJson ?? (await this.getEditableVersion(id, false))?.graphJson ?? emptyGraphJson();
    const validation = validateNarrativeGraph(payload);
    
    if (validation.valid) {
      const resourceValidation = await this.validateNarrativeResources(user, payload as NarrativeGraphJson);
      if (!resourceValidation.valid) {
        validation.valid = false;
        validation.errors.push(...resourceValidation.errors);
      }
    }

    return validation;
  }

  async publish(
    user: AuthenticatedUser,
    id: string,
    _dto: PublishNarrativeDto,
  ) {
    const narrative = await this.getNarrativeOrThrow(user, id);
    const draftVersion = await this.getEditableVersion(narrative.id, true);

    if (!draftVersion) {
      throw new NotFoundException('Editable narrative version not found');
    }

    const validation = validateNarrativeGraph(draftVersion.graphJson);
    if (!validation.valid) {
      throw new BadRequestException(validation.errors);
    }

    const resourceValidation = await this.validateNarrativeResources(user, draftVersion.graphJson as NarrativeGraphJson);
    if (!resourceValidation.valid) {
      throw new BadRequestException(resourceValidation.errors);
    }

    return this.prisma.$transaction(async (tx) => {
      const publishedVersion = await tx.narrativeVersion.update({
        where: { id: draftVersion.id },
        data: {
          status: PUBLISHED_STATUS,
          publishedAt: new Date(),
          publishedByUserId: user.id,
        },
      });

      const narrativeAfterPublish = await tx.narrative.update({
        where: { id: narrative.id },
        data: {
          status: ACTIVE_STATUS,
          publishedVersionId: publishedVersion.id,
          updatedByUserId: user.id,
        },
      });

      const nextVersionNumber = publishedVersion.versionNumber + 1;
      const newDraft = await tx.narrativeVersion.create({
        data: {
          narrativeId: narrative.id,
          versionNumber: nextVersionNumber,
          status: DRAFT_STATUS,
          graphJson: cloneGraphJson(
            publishedVersion.graphJson as NarrativeGraphJson,
          ) as Prisma.InputJsonValue,
        },
      });

      return {
        narrative: narrativeAfterPublish,
        publishedVersion,
        nextDraftVersion: newDraft,
      };
    });
  }

  async getPublishedVersionOrThrow(user: AuthenticatedUser, id: string) {
    const narrative = await this.getNarrativeOrThrow(user, id);

    if (!narrative.publishedVersionId) {
      throw new BadRequestException('Narrative has not been published yet');
    }

    const version = await this.prisma.narrativeVersion.findFirst({
      where: {
        id: narrative.publishedVersionId,
        narrativeId: narrative.id,
      },
    });

    if (!version) {
      throw new NotFoundException('Published narrative version not found');
    }

    return version;
  }

  private async getNarrativeOrThrow(user: AuthenticatedUser, id: string) {
    const narrative = await this.prisma.narrative.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
      include: {
        createdBy: {
          select: { id: true, fullName: true, email: true },
        },
        updatedBy: {
          select: { id: true, fullName: true, email: true },
        },
        publishedVersion: {
          select: {
            id: true,
            versionNumber: true,
            status: true,
            publishedAt: true,
            graphJson: true,
          },
        },
        versions: {
          orderBy: { versionNumber: 'desc' },
          select: {
            id: true,
            versionNumber: true,
            status: true,
            publishedAt: true,
            createdAt: true,
            publishedBy: {
              select: { id: true, fullName: true, email: true },
            },
          },
        },
        _count: {
          select: {
            versions: true,
            runs: true,
          },
        },
      },
    });

    if (!narrative) {
      throw new NotFoundException('Narrative not found');
    }

    return narrative;
  }

  private async getEditableVersion(
    narrativeId: string,
    createIfMissing: boolean,
  ) {
    const draftVersion = await this.prisma.narrativeVersion.findFirst({
      where: {
        narrativeId,
        status: DRAFT_STATUS,
      },
      orderBy: {
        versionNumber: 'desc',
      },
    });

    if (draftVersion || !createIfMissing) {
      return draftVersion;
    }

    const latestVersion = await this.prisma.narrativeVersion.findFirst({
      where: { narrativeId },
      orderBy: {
        versionNumber: 'desc',
      },
    });

    const nextVersionNumber = (latestVersion?.versionNumber ?? 0) + 1;

    return this.prisma.narrativeVersion.create({
      data: {
        narrativeId,
        versionNumber: nextVersionNumber,
        status: DRAFT_STATUS,
        graphJson: cloneGraphJson(
          (latestVersion?.graphJson as NarrativeGraphJson) ?? emptyGraphJson(),
        ) as Prisma.InputJsonValue,
      },
    });
  }

  private async validateNarrativeResources(
    user: AuthenticatedUser,
    graph: NarrativeGraphJson,
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const audioIds = new Set<string>();
    const buttonIds = new Set<string>();

    for (const node of graph.nodes) {
      if (node.type === 'AUDIO') {
        const audioAssetId = node.data?.audioAssetId;
        if (!audioAssetId || typeof audioAssetId !== 'string') {
          errors.push(`Node ${node.id} (AUDIO) requires audioAssetId`);
        } else {
          audioIds.add(audioAssetId);
        }
      } else if (node.type === 'AUDIO_BUTTON') {
        const audioButtonId = node.data?.audioButtonId;
        if (!audioButtonId || typeof audioButtonId !== 'string') {
          errors.push(`Node ${node.id} (AUDIO_BUTTON) requires audioButtonId`);
        } else {
          buttonIds.add(audioButtonId);
        }
      }
    }

    if (audioIds.size > 0) {
      const validAudios = await this.prisma.audioAsset.findMany({
        where: {
          id: { in: Array.from(audioIds) },
          organizationId: user.organizationId,
          isActive: true,
        },
        select: { id: true },
      });
      const validAudioIds = new Set(validAudios.map((a) => a.id));
      for (const id of audioIds) {
        if (!validAudioIds.has(id)) {
          errors.push(`Audio asset ${id} is invalid, inactive, or belongs to another organization`);
        }
      }
    }

    if (buttonIds.size > 0) {
      const validButtons = await this.prisma.audioButton.findMany({
        where: {
          id: { in: Array.from(buttonIds) },
          organizationId: user.organizationId,
          isActive: true,
        },
        select: { id: true },
      });
      const validButtonIds = new Set(validButtons.map((b) => b.id));
      for (const id of buttonIds) {
        if (!validButtonIds.has(id)) {
          errors.push(`Audio button ${id} is invalid, inactive, or belongs to another organization`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
