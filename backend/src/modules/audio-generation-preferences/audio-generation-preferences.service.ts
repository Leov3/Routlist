import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../shared/types/authenticated-user';
import { UpdateAudioGenerationPreferencesDto } from './dto/update-audio-generation-preferences.dto';

const DEFAULT_PREFERENCES = {
  composerText: '',
  composerVoiceId: '',
  composerModelId: '',
  composerOutputFormat: 'mp3_44100_128',
  composerStability: 0.5,
  composerSimilarityBoost: 0.75,
  composerStyle: 0,
  composerSpeed: 1,
  composerSpeakerBoost: true,
} as const;

@Injectable()
export class AudioGenerationPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async get(user: AuthenticatedUser) {
    const preferences = await this.prisma.userAudioGenerationPreference.findUnique({
      where: {
        organizationId_userId: {
          organizationId: user.organizationId,
          userId: user.id,
        },
      },
    });

    return preferences ?? { ...DEFAULT_PREFERENCES };
  }

  async update(user: AuthenticatedUser, dto: UpdateAudioGenerationPreferencesDto) {
    return this.prisma.userAudioGenerationPreference.upsert({
      where: {
        organizationId_userId: {
          organizationId: user.organizationId,
          userId: user.id,
        },
      },
      create: {
        organizationId: user.organizationId,
        userId: user.id,
        composerText: dto.composerText ?? DEFAULT_PREFERENCES.composerText,
        composerVoiceId: dto.composerVoiceId ?? DEFAULT_PREFERENCES.composerVoiceId,
        composerModelId: dto.composerModelId ?? DEFAULT_PREFERENCES.composerModelId,
        composerOutputFormat:
          dto.composerOutputFormat ?? DEFAULT_PREFERENCES.composerOutputFormat,
        composerStability: dto.composerStability ?? DEFAULT_PREFERENCES.composerStability,
        composerSimilarityBoost:
          dto.composerSimilarityBoost ?? DEFAULT_PREFERENCES.composerSimilarityBoost,
        composerStyle: dto.composerStyle ?? DEFAULT_PREFERENCES.composerStyle,
        composerSpeed: dto.composerSpeed ?? DEFAULT_PREFERENCES.composerSpeed,
        composerSpeakerBoost:
          typeof dto.composerSpeakerBoost === 'boolean'
            ? dto.composerSpeakerBoost
            : DEFAULT_PREFERENCES.composerSpeakerBoost,
      },
      update: {
        ...(dto.composerText !== undefined ? { composerText: dto.composerText } : {}),
        ...(dto.composerVoiceId !== undefined ? { composerVoiceId: dto.composerVoiceId } : {}),
        ...(dto.composerModelId !== undefined ? { composerModelId: dto.composerModelId } : {}),
        ...(dto.composerOutputFormat !== undefined
          ? { composerOutputFormat: dto.composerOutputFormat }
          : {}),
        ...(typeof dto.composerStability === 'number'
          ? { composerStability: dto.composerStability }
          : {}),
        ...(typeof dto.composerSimilarityBoost === 'number'
          ? { composerSimilarityBoost: dto.composerSimilarityBoost }
          : {}),
        ...(typeof dto.composerStyle === 'number'
          ? { composerStyle: dto.composerStyle }
          : {}),
        ...(typeof dto.composerSpeed === 'number' ? { composerSpeed: dto.composerSpeed } : {}),
        ...(typeof dto.composerSpeakerBoost === 'boolean'
          ? { composerSpeakerBoost: dto.composerSpeakerBoost }
          : {}),
      },
    });
  }
}
