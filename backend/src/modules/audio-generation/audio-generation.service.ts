import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../shared/types/authenticated-user';
import { LocalStorageService } from '../storage/local-storage.service';
import { ElevenLabsService } from '../integrations/elevenlabs/elevenlabs.service';
import type { GenerateElevenLabsAudioDto } from '../integrations/elevenlabs/dto/elevenlabs-settings.dto';
import type { GenerateAudioGenerationDto } from './dto/generate-audio-generation.dto';
import type { CreateGeneratedButtonDto } from './dto/create-generated-button.dto';
import type { AudioGenerationQueryDto } from './dto/audio-generation-query.dto';

const TEMPORARY_TTL_MS = 48 * 60 * 60 * 1000;
const DEFAULT_BUTTON_COLOR = '#047857';

type GeneratedAudioAsset = {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds: number | null;
  transcript: string | null;
  sourceType: string;
  lifecycleStatus: string;
  expiresAt: Date | null;
  generatedText: string | null;
  generatedVoiceId: string | null;
  generatedVoiceName: string | null;
  generatedModelId: string | null;
  generatedOutputFormat: string | null;
  autoCreatedButtonId: string | null;
  createdAt: Date;
  updatedAt: Date;
  audioUrl: string;
  audioDownloadUrl: string;
  createdBy: {
    id: string;
    fullName: string;
    email: string;
  };
};

type GeneratedJob = {
  id: string;
  status: string;
  provider: string;
  inputText: string;
  normalizedText: string;
  voiceId: string;
  voiceName: string | null;
  modelId: string;
  outputFormat: string;
  stability: number;
  similarityBoost: number;
  style: number;
  speed: number;
  speakerBoost: boolean;
  requestHash: string;
  audioAssetId: string | null;
  audioButtonId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  attemptCount: number;
  lastAttemptAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  asset: GeneratedAudioAsset | null;
};

@Injectable()
export class AudioGenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly elevenLabsService: ElevenLabsService,
    private readonly storage: LocalStorageService,
  ) {}

  async generate(user: AuthenticatedUser, dto: GenerateAudioGenerationDto) {
    const normalizedText = this.normalizeText(dto.text);
    if (!normalizedText) {
      throw new BadRequestException('Debes escribir un texto para generar audio.');
    }

    if (dto.createButton) {
      if (!user.permissions.includes('button:create')) {
        throw new ForbiddenException(
          'No tienes permisos para convertir el audio generado en botón.',
        );
      }

      if (!dto.buttonCategoryId) {
        throw new BadRequestException(
          'Debes seleccionar una categoría para crear el botón.',
        );
      }
    }

    const requestHash = this.buildRequestHash(user.organizationId, {
      text: normalizedText,
      voiceId: dto.voiceId ?? '',
      modelId: dto.modelId ?? '',
      outputFormat: dto.outputFormat ?? '',
      stability: dto.stability,
      similarityBoost: dto.similarityBoost,
      style: dto.style,
      speed: dto.speed,
      speakerBoost: dto.speakerBoost,
    });

    const existing = await this.prisma.audioGenerationJob.findFirst({
      where: {
        organizationId: user.organizationId,
        requestHash,
        status: 'COMPLETED',
        audioAssetId: { not: null },
      },
      include: {
        audioAsset: {
          include: {
            createdBy: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (existing?.audioAsset) {
      return {
        job: this.serializeJob(existing),
        asset: this.serializeAsset(existing.audioAsset),
        reused: true,
      };
    }

    const voiceName = dto.voiceName?.trim() || dto.voiceId?.trim() || null;
    const job = await this.prisma.audioGenerationJob.create({
      data: {
        organizationId: user.organizationId,
        createdById: user.id,
        provider: 'elevenlabs',
        status: 'PROCESSING',
        inputText: dto.text,
        normalizedText,
        voiceId: dto.voiceId ?? '',
        voiceName,
        modelId: dto.modelId ?? '',
        outputFormat: dto.outputFormat ?? '',
        stability: dto.stability ?? 0.5,
        similarityBoost: dto.similarityBoost ?? 0.75,
        style: dto.style ?? 0,
        speed: dto.speed ?? 1,
        speakerBoost: dto.speakerBoost ?? true,
        requestHash,
        attemptCount: 1,
        lastAttemptAt: new Date(),
      },
    });

    try {
      const audio = await this.elevenLabsService.generateAudioBuffer(user, {
        text: normalizedText,
        defaultVoiceId: dto.voiceId,
        defaultModelId: dto.modelId,
        defaultOutputFormat: dto.outputFormat,
        stability: dto.stability,
        similarityBoost: dto.similarityBoost,
        style: dto.style,
        speed: dto.speed,
        speakerBoost: dto.speakerBoost,
      });

      const stored = await this.storage.saveAudio(user.organizationId, {
        buffer: audio.buffer,
        originalname: this.fileNameFor(normalizedText, audio.fileName),
        mimetype: audio.contentType,
        size: audio.buffer.length,
      } as Express.Multer.File, 'audio-temporary');

      const expiresAt = new Date(Date.now() + TEMPORARY_TTL_MS);
      const asset = await this.prisma.audioAsset.create({
        data: {
          organizationId: user.organizationId,
          fileName: stored.fileName,
          originalName: this.originalNameFor(normalizedText),
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          storageDriver: stored.storageDriver,
          storageKey: stored.storageKey,
          createdById: user.id,
          transcript: normalizedText,
          sourceType: 'TTS',
          lifecycleStatus: 'TEMPORARY',
          expiresAt,
          generatedText: normalizedText,
          generatedVoiceId: dto.voiceId ?? null,
          generatedVoiceName: voiceName,
          generatedModelId: dto.modelId ?? null,
          generatedOutputFormat: dto.outputFormat ?? null,
          generatedSettingsJson: {
            stability: dto.stability ?? 0.5,
            similarityBoost: dto.similarityBoost ?? 0.75,
            style: dto.style ?? 0,
            speed: dto.speed ?? 1,
            speakerBoost: dto.speakerBoost ?? true,
          } as Prisma.InputJsonValue,
          generationJobId: job.id,
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

      let createdButton: Awaited<ReturnType<typeof this.createButtonFromAssetInternal>> | null = null;
      if (dto.createButton) {
      createdButton = await this.createButtonFromAssetInternal(user, asset.id, {
        label: dto.buttonLabel ?? this.originalNameFor(normalizedText),
        categoryId: dto.buttonCategoryId as string,
        description: dto.buttonDescription,
        color: dto.buttonColor,
        shortcutKey: dto.buttonShortcutKey,
          sortOrder: dto.buttonSortOrder,
        });
      }

      await this.prisma.audioGenerationJob.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          audioAssetId: asset.id,
          audioButtonId: createdButton?.id ?? null,
          completedAt: new Date(),
          errorCode: null,
          errorMessage: null,
        },
      });

      return {
        job: await this.getJobOrThrow(user, job.id),
        asset: this.serializeAsset(asset),
        button: createdButton,
        reused: false,
      };
    } catch (error) {
      await this.prisma.audioGenerationJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          errorCode: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
          errorMessage: error instanceof Error ? error.message : 'No se pudo generar el audio.',
        },
      });
      throw error;
    }
  }

  async listJobs(user: AuthenticatedUser, query: AudioGenerationQueryDto) {
    const jobs = await this.prisma.audioGenerationJob.findMany({
      where: {
        organizationId: user.organizationId,
        ...(query.voiceId ? { voiceId: query.voiceId } : {}),
        ...(query.modelId ? { modelId: query.modelId } : {}),
        ...(query.lifecycleStatus && query.lifecycleStatus !== 'all'
          ? {
              audioAsset: {
                lifecycleStatus: query.lifecycleStatus,
              },
            }
          : {}),
        ...(query.search
          ? {
              OR: [
                { inputText: { contains: query.search, mode: 'insensitive' } },
                { normalizedText: { contains: query.search, mode: 'insensitive' } },
                { voiceName: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        audioAsset: {
          include: {
            createdBy: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      items: jobs.map((job) => this.serializeJob(job)),
    };
  }

  async listLibrary(user: AuthenticatedUser, query: AudioGenerationQueryDto) {
    const assets = await this.prisma.audioAsset.findMany({
      where: {
        organizationId: user.organizationId,
        sourceType: 'TTS',
        ...(query.voiceId ? { generatedVoiceId: query.voiceId } : {}),
        ...(query.modelId ? { generatedModelId: query.modelId } : {}),
        ...(query.lifecycleStatus && query.lifecycleStatus !== 'all'
          ? { lifecycleStatus: query.lifecycleStatus }
          : {}),
        ...(query.search
          ? {
              OR: [
                { originalName: { contains: query.search, mode: 'insensitive' } },
                { transcript: { contains: query.search, mode: 'insensitive' } },
                { generatedText: { contains: query.search, mode: 'insensitive' } },
                { generatedVoiceName: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
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
      orderBy: { createdAt: 'desc' },
    });

    return {
      items: assets.map((asset) => this.serializeAsset(asset)),
    };
  }

  async getJob(user: AuthenticatedUser, id: string) {
    return this.getJobOrThrow(user, id);
  }

  async retry(user: AuthenticatedUser, id: string, dto?: GenerateAudioGenerationDto) {
    const job = await this.getJobOrThrow(user, id);
    if (job.status === 'PROCESSING') {
      throw new BadRequestException('Este audio ya se está generando.');
    }

    return this.generate(user, {
      text: dto?.text ?? job.normalizedText,
      voiceId: dto?.voiceId ?? job.voiceId,
      voiceName: dto?.voiceName ?? job.voiceName ?? job.voiceId,
      modelId: dto?.modelId ?? job.modelId,
      outputFormat: dto?.outputFormat ?? job.outputFormat,
      stability: dto?.stability ?? job.stability,
      similarityBoost: dto?.similarityBoost ?? job.similarityBoost,
      style: dto?.style ?? job.style,
      speed: dto?.speed ?? job.speed,
      speakerBoost: dto?.speakerBoost ?? job.speakerBoost,
      createButton: dto?.createButton,
      buttonLabel: dto?.buttonLabel,
      buttonCategoryId: dto?.buttonCategoryId,
      buttonDescription: dto?.buttonDescription,
      buttonColor: dto?.buttonColor,
      buttonShortcutKey: dto?.buttonShortcutKey,
      buttonSortOrder: dto?.buttonSortOrder,
    });
  }

  async createButton(
    user: AuthenticatedUser,
    id: string,
    dto: CreateGeneratedButtonDto,
  ) {
    if (!user.permissions.includes('button:create')) {
      throw new ForbiddenException(
        'No tienes permisos para convertir audios en botones permanentes.',
      );
    }

    const asset = await this.prisma.audioAsset.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
        sourceType: 'TTS',
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

    if (!asset) {
      throw new NotFoundException('No se encontró el audio generado.');
    }

    if (asset.lifecycleStatus === 'PERSISTED' && asset.autoCreatedButtonId) {
      return this.createButtonResponse(
        user.organizationId,
        asset.autoCreatedButtonId,
        asset,
        dto,
      );
    }

    return this.createButtonFromAssetInternal(user, asset.id, dto);
  }

  async delete(user: AuthenticatedUser, id: string) {
    const asset = await this.prisma.audioAsset.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
        sourceType: 'TTS',
      },
      select: {
        id: true,
        organizationId: true,
        fileName: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
        durationSeconds: true,
        storageDriver: true,
        storageKey: true,
        publicUrl: true,
        transcript: true,
        sourceType: true,
        lifecycleStatus: true,
        expiresAt: true,
        generatedText: true,
        generatedVoiceId: true,
        generatedVoiceName: true,
        generatedModelId: true,
        generatedOutputFormat: true,
        generatedSettingsJson: true,
        generationJobId: true,
        autoCreatedButtonId: true,
        createdById: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!asset) {
      throw new NotFoundException('No se encontró el audio generado.');
    }

    if (asset.lifecycleStatus !== 'TEMPORARY') {
      throw new BadRequestException(
        'Solo se pueden eliminar audios temporales desde este módulo.',
      );
    }

    await this.storage.deleteAudio(asset.storageKey);

    if (asset.generationJobId) {
      await this.prisma.audioGenerationJob.update({
        where: { id: asset.generationJobId },
        data: {
          status: 'EXPIRED',
          audioAssetId: null,
          completedAt: new Date(),
        },
      });
    }

    await this.prisma.audioAsset.deleteMany({
      where: {
        id: asset.id,
        organizationId: user.organizationId,
      },
    });

    return { ok: true };
  }

  async cleanupExpiredTemporaryAssets() {
    const expiredAssets = await this.prisma.audioAsset.findMany({
      where: {
        sourceType: 'TTS',
        lifecycleStatus: 'TEMPORARY',
        expiresAt: {
          lt: new Date(),
        },
      },
      select: {
        id: true,
        storageKey: true,
        generationJobId: true,
      },
    });

    if (!expiredAssets.length) {
      return { deleted: 0 };
    }

    for (const asset of expiredAssets) {
      await this.storage.deleteAudio(asset.storageKey);
      if (asset.generationJobId) {
        await this.prisma.audioGenerationJob.update({
          where: { id: asset.generationJobId },
          data: {
            status: 'EXPIRED',
            audioAssetId: null,
            completedAt: new Date(),
          },
        });
      }
    }

    await this.prisma.audioAsset.deleteMany({
      where: {
        id: { in: expiredAssets.map((asset) => asset.id) },
        sourceType: 'TTS',
        lifecycleStatus: 'TEMPORARY',
      },
    });

    return { deleted: expiredAssets.length };
  }

  private async createButtonFromAssetInternal(
    user: AuthenticatedUser,
    assetId: string,
    dto: CreateGeneratedButtonDto,
  ) {
    const asset = await this.prisma.audioAsset.findFirst({
      where: { id: assetId, organizationId: user.organizationId },
    });

    if (!asset) {
      throw new NotFoundException('No se encontró el audio generado.');
    }

    const category = await this.prisma.audioCategory.findFirst({
      where: {
        id: dto.categoryId,
        organizationId: user.organizationId,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!category) {
      throw new NotFoundException('La categoría seleccionada no existe.');
    }

    const maxSortOrder = await this.prisma.audioButton.aggregate({
      where: {
        organizationId: user.organizationId,
        categoryId: category.id,
      },
      _max: { sortOrder: true },
    });

    const button = await this.prisma.audioButton.create({
      data: {
        organizationId: user.organizationId,
        categoryId: category.id,
        audioAssetId: asset.id,
        label: dto.label,
        description: dto.description,
        color: dto.color ?? DEFAULT_BUTTON_COLOR,
        shortcutKey: dto.shortcutKey,
        sortOrder:
          dto.sortOrder ?? ((maxSortOrder._max.sortOrder ?? -1) + 1),
      },
    });

    await this.prisma.audioAsset.update({
      where: { id: asset.id },
      data: {
        lifecycleStatus: 'PERSISTED',
        expiresAt: null,
        autoCreatedButtonId: button.id,
      },
    });

    await this.prisma.audioGenerationJob.updateMany({
      where: {
        organizationId: user.organizationId,
        audioAssetId: asset.id,
      },
      data: {
        audioButtonId: button.id,
        status: 'COMPLETED',
      },
    });

    return this.createButtonResponse(
      user.organizationId,
      button.id,
      asset,
      dto,
      category,
    );
  }

  private async createButtonResponse(
    organizationId: string,
    buttonId: string,
    asset: {
      id: string;
      originalName: string;
      durationSeconds: number | null;
      mimeType: string;
      transcript: string | null;
      createdAt: Date;
    },
    dto: CreateGeneratedButtonDto,
    category?: { id: string; name: string },
    ) {
    const button = await this.prisma.audioButton.findFirst({
      where: {
        id: buttonId,
        organizationId,
      },
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
      return {
        id: buttonId,
        label: dto.label,
        category: category ?? { id: dto.categoryId, name: 'Categoría' },
        audioUrl: `/audio-assets/${asset.id}/stream`,
        audioAsset: {
          id: asset.id,
          originalName: asset.originalName,
          durationSeconds: asset.durationSeconds,
          mimeType: asset.mimeType,
          transcript: asset.transcript,
          createdAt: asset.createdAt,
          audioUrl: `/audio-assets/${asset.id}/stream`,
          audioDownloadUrl: `/audio-assets/${asset.id}/download`,
        },
      };
    }

    return {
      id: button.id,
      label: button.label,
      description: button.description,
      color: button.color,
      shortcutKey: button.shortcutKey,
      sortOrder: button.sortOrder,
      category: button.category,
      audioUrl: `/audio-assets/${button.audioAssetId}/stream`,
      audioAsset: {
        ...button.audioAsset,
        audioUrl: `/audio-assets/${button.audioAssetId}/stream`,
        audioDownloadUrl: `/audio-assets/${button.audioAssetId}/download`,
      },
    };
  }

  private serializeAsset(asset: any): GeneratedAudioAsset {
    return {
      id: asset.id,
      fileName: asset.fileName,
      originalName: asset.originalName,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      durationSeconds: asset.durationSeconds ?? null,
      transcript: asset.transcript ?? null,
      sourceType: asset.sourceType,
      lifecycleStatus: asset.lifecycleStatus,
      expiresAt: asset.expiresAt ? new Date(asset.expiresAt) : null,
      generatedText: asset.generatedText ?? null,
      generatedVoiceId: asset.generatedVoiceId ?? null,
      generatedVoiceName: asset.generatedVoiceName ?? null,
      generatedModelId: asset.generatedModelId ?? null,
      generatedOutputFormat: asset.generatedOutputFormat ?? null,
      autoCreatedButtonId: asset.autoCreatedButtonId ?? null,
      createdAt: new Date(asset.createdAt),
      updatedAt: new Date(asset.updatedAt),
      audioUrl: `/audio-assets/${asset.id}/stream`,
      audioDownloadUrl: `/audio-assets/${asset.id}/download`,
      createdBy: asset.createdBy,
    };
  }

  private serializeJob(job: any): GeneratedJob {
    return {
      id: job.id,
      status: job.status,
      provider: job.provider,
      inputText: job.inputText,
      normalizedText: job.normalizedText,
      voiceId: job.voiceId,
      voiceName: job.voiceName ?? null,
      modelId: job.modelId,
      outputFormat: job.outputFormat,
      stability: job.stability,
      similarityBoost: job.similarityBoost,
      style: job.style,
      speed: job.speed,
      speakerBoost: job.speakerBoost,
      requestHash: job.requestHash,
      audioAssetId: job.audioAssetId ?? null,
      audioButtonId: job.audioButtonId ?? null,
      errorCode: job.errorCode ?? null,
      errorMessage: job.errorMessage ?? null,
      attemptCount: job.attemptCount,
      lastAttemptAt: job.lastAttemptAt ? new Date(job.lastAttemptAt) : null,
      completedAt: job.completedAt ? new Date(job.completedAt) : null,
      createdAt: new Date(job.createdAt),
      updatedAt: new Date(job.updatedAt),
      asset: job.audioAsset ? this.serializeAsset(job.audioAsset) : null,
    };
  }

  private async getJobOrThrow(user: AuthenticatedUser, id: string) {
    const job = await this.prisma.audioGenerationJob.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
      include: {
        audioAsset: {
          include: {
            createdBy: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException('No se encontró la generación.');
    }

    return this.serializeJob(job);
  }

  private normalizeText(value: string) {
    return value.replace(/\s+/g, ' ').trim();
  }

  private buildRequestHash(
    organizationId: string,
    payload: Record<string, unknown>,
  ) {
    return createHash('sha256')
      .update(
        JSON.stringify({
          organizationId,
          ...payload,
        }),
      )
      .digest('hex');
  }

  private fileNameFor(text: string, defaultName: string) {
    const base = text
      .slice(0, 40)
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
    const suffix = defaultName.includes('.') ? defaultName.split('.').pop() ?? 'mp3' : 'mp3';
    return `${base || 'audio-ia'}-${Date.now()}.${suffix}`;
  }

  private originalNameFor(text: string) {
    const preview = text.slice(0, 55).replace(/\s+/g, ' ').trim();
    return preview.length > 0 ? `${preview}${text.length > 55 ? '…' : ''}` : 'Audio IA';
  }

}
