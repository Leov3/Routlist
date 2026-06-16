import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../shared/types/authenticated-user';
import { emptyGraphJson } from '../narratives/narrative-graph';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildSlug(name: string, explicitSlug?: string) {
    const source = explicitSlug?.trim() || name;
    return source
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64);
  }

  list(user: AuthenticatedUser) {
    this.ensureGlobalOwner(user);

    return this.prisma.organization.findMany({
      orderBy: [{ createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        maxUsers: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            members: true,
            audioAssets: true,
            audioCategories: true,
            audioButtons: true,
          },
        },
      },
    });
  }

  current(user: AuthenticatedUser) {
    return this.prisma.organization.findFirstOrThrow({
      where: {
        id: user.organizationId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        maxUsers: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  create(user: AuthenticatedUser, dto: CreateOrganizationDto) {
    this.ensureGlobalOwner(user);

    return this.prisma.organization.create({
      data: {
        name: dto.name,
        slug: this.buildSlug(dto.name, dto.slug),
        status: dto.status ?? 'ACTIVE',
        ...(dto.maxUsers ? { maxUsers: dto.maxUsers } : {}),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        maxUsers: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateOrganizationDto) {
    this.ensureGlobalOwner(user);

    const organization = await this.prisma.organization.findFirst({
      where: { id },
      select: { id: true },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return this.prisma.organization.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.name || dto.slug
          ? { slug: this.buildSlug(dto.name ?? '', dto.slug ?? dto.name) }
          : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.maxUsers ? { maxUsers: dto.maxUsers } : {}),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        maxUsers: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async remove(user: AuthenticatedUser, id: string) {
    this.ensureGlobalOwner(user);

    if (user.organizationId === id) {
      throw new ConflictException('Switch to another organization before deleting this one');
    }

    const organization = await this.prisma.organization.findFirst({
      where: { id },
      select: { id: true },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    await this.prisma.$transaction(async (tx) => {
      const narratives = await tx.narrative.findMany({
        where: { organizationId: id },
        select: { id: true },
      });
      const narrativeIds = narratives.map((item) => item.id);

      const narrativeRuns = await tx.narrativeRun.findMany({
        where: { organizationId: id },
        select: { id: true },
      });
      const narrativeRunIds = narrativeRuns.map((item) => item.id);

      const audioButtons = await tx.audioButton.findMany({
        where: { organizationId: id },
        select: { id: true },
      });
      const audioButtonIds = audioButtons.map((item) => item.id);

      const audioAssets = await tx.audioAsset.findMany({
        where: { organizationId: id },
        select: { id: true },
      });
      const audioAssetIds = audioAssets.map((item) => item.id);

      await tx.narrativeRunEvent.deleteMany({
        where: {
          narrativeRunId: { in: narrativeRunIds },
        },
      });

      await tx.narrativeRun.deleteMany({
        where: { id: { in: narrativeRunIds } },
      });

      await tx.narrativeVersion.deleteMany({
        where: { narrativeId: { in: narrativeIds } },
      });

      await tx.narrative.deleteMany({
        where: { id: { in: narrativeIds } },
      });

      await tx.playbackEvent.deleteMany({
        where: { organizationId: id },
      });

      await tx.audioButtonFavorite.deleteMany({
        where: { organizationId: id },
      });

      await tx.audioButton.deleteMany({
        where: { id: { in: audioButtonIds } },
      });

      await tx.audioAsset.deleteMany({
        where: { id: { in: audioAssetIds } },
      });

      await tx.audioGenerationJob.deleteMany({
        where: { organizationId: id },
      });

      await tx.audioCategory.deleteMany({
        where: { organizationId: id },
      });

      await tx.userBoardPreference.deleteMany({
        where: { organizationId: id },
      });

      await tx.userNarrativePreference.deleteMany({
        where: { organizationId: id },
      });

      await tx.userAudioGenerationPreference.deleteMany({
        where: { organizationId: id },
      });

      await tx.elevenLabsIntegrationSetting.deleteMany({
        where: { organizationId: id },
      });

      await tx.maintenanceBackup.deleteMany({
        where: { organizationId: id },
      });

      await tx.maintenanceBackupSetting.deleteMany({
        where: { organizationId: id },
      });

      await tx.systemAuditEvent.deleteMany({
        where: { organizationId: id },
      });

      await tx.userSession.deleteMany({
        where: { organizationId: id },
      });

      await tx.organizationMember.deleteMany({
        where: { organizationId: id },
      });

      await tx.organization.delete({
        where: { id },
      });
    });

    return { ok: true };
  }

  async narrativeIntegrity(user: AuthenticatedUser, id: string) {
    this.ensureGlobalOwner(user);

    const organization = await this.prisma.organization.findFirst({
      where: { id },
      select: { id: true, name: true },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const narratives = await this.prisma.narrative.findMany({
      where: { organizationId: id },
      select: {
        id: true,
        title: true,
        status: true,
        organizationId: true,
        publishedVersionId: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          select: {
            id: true,
            versionNumber: true,
            graphJson: true,
          },
        },
        publishedVersion: {
          select: {
            id: true,
            versionNumber: true,
            graphJson: true,
          },
        },
      },
    });

    type IntegrityIssue = {
      narrativeId: string;
      narrativeTitle: string;
      type: string;
      resourceId: string;
      message: string;
    };

    type IntegrityAudio = {
      id: string;
      organizationId: string;
      originalName: string;
    };

    type IntegrityButton = {
      id: string;
      organizationId: string;
      label: string;
    };

    const issues: IntegrityIssue[] = [];

    for (const narrative of narratives) {
      const sourceGraph =
        narrative.publishedVersion?.graphJson ??
        narrative.versions[0]?.graphJson ??
        emptyGraphJson();
      const graph = sourceGraph as {
        nodes?: Array<{ id?: string; type?: string; data?: Record<string, unknown> }>;
      };
      const audioIds = new Set<string>();
      const buttonIds = new Set<string>();

      for (const node of graph.nodes ?? []) {
        if (node.type === 'AUDIO' && typeof node.data?.audioAssetId === 'string') {
          audioIds.add(node.data.audioAssetId);
        }
        if (node.type === 'AUDIO_BUTTON' && typeof node.data?.audioButtonId === 'string') {
          buttonIds.add(node.data.audioButtonId);
        }
      }

      const audios: IntegrityAudio[] = audioIds.size
        ? await this.prisma.audioAsset.findMany({
            where: { id: { in: Array.from(audioIds) } },
            select: { id: true, organizationId: true, originalName: true },
          })
        : [];
      const buttons: IntegrityButton[] = buttonIds.size
        ? await this.prisma.audioButton.findMany({
            where: { id: { in: Array.from(buttonIds) } },
            select: { id: true, organizationId: true, label: true },
          })
        : [];

      const audioMap = new Map<string, IntegrityAudio>(
        audios.map((audio) => [audio.id, audio] as const),
      );
      const buttonMap = new Map<string, IntegrityButton>(
        buttons.map((button) => [button.id, button] as const),
      );

      for (const audioId of audioIds) {
        const audio = audioMap.get(audioId);
        if (!audio) {
          issues.push({
            narrativeId: narrative.id,
            narrativeTitle: narrative.title,
            type: 'missing_audio',
            resourceId: audioId,
            message: `Audio ${audioId} no existe o fue eliminado.`,
          });
          continue;
        }
        if (audio.organizationId !== id) {
          issues.push({
            narrativeId: narrative.id,
            narrativeTitle: narrative.title,
            type: 'cross_tenant_audio',
            resourceId: audioId,
            message: `Audio ${audioId} pertenece a otra organización (${audio.organizationId}).`,
          });
        }
      }

      for (const buttonId of buttonIds) {
        const button = buttonMap.get(buttonId);
        if (!button) {
          issues.push({
            narrativeId: narrative.id,
            narrativeTitle: narrative.title,
            type: 'missing_button',
            resourceId: buttonId,
            message: `Botón ${buttonId} no existe o fue eliminado.`,
          });
          continue;
        }
        if (button.organizationId !== id) {
          issues.push({
            narrativeId: narrative.id,
            narrativeTitle: narrative.title,
            type: 'cross_tenant_button',
            resourceId: buttonId,
            message: `Botón ${buttonId} pertenece a otra organización (${button.organizationId}).`,
          });
        }
      }
    }

    return {
      organization,
      narrativesCount: narratives.length,
      issuesCount: issues.length,
      issues,
      ok: issues.length === 0,
    };
  }

  private ensureGlobalOwner(user: AuthenticatedUser) {
    if (user.role !== 'OWNER') {
      throw new ForbiddenException('Only OWNER can manage organizations');
    }
  }
}
