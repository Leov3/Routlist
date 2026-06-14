import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../shared/types/authenticated-user';
import { UpdateNarrativePreferencesDto } from './dto/update-narrative-preferences.dto';

const DEFAULT_PREFERENCES = {
  playerDistance: 'max',
  playerViewportX: 0,
  playerViewportY: 0,
  playerViewportZoom: 0.8,
} as const;

@Injectable()
export class NarrativePreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async get(user: AuthenticatedUser) {
    const preferences = await this.prisma.userNarrativePreference.findUnique({
      where: {
        organizationId_userId: {
          organizationId: user.organizationId,
          userId: user.id,
        },
      },
    });

    return preferences ?? { ...DEFAULT_PREFERENCES };
  }

  async update(user: AuthenticatedUser, dto: UpdateNarrativePreferencesDto) {
    return this.prisma.userNarrativePreference.upsert({
      where: {
        organizationId_userId: {
          organizationId: user.organizationId,
          userId: user.id,
        },
      },
      create: {
        organizationId: user.organizationId,
        userId: user.id,
        playerDistance: dto.playerDistance ?? DEFAULT_PREFERENCES.playerDistance,
        playerViewportX: dto.playerViewportX ?? DEFAULT_PREFERENCES.playerViewportX,
        playerViewportY: dto.playerViewportY ?? DEFAULT_PREFERENCES.playerViewportY,
        playerViewportZoom: dto.playerViewportZoom ?? DEFAULT_PREFERENCES.playerViewportZoom,
      },
      update: {
        ...(dto.playerDistance ? { playerDistance: dto.playerDistance } : {}),
        ...(typeof dto.playerViewportX === 'number' ? { playerViewportX: dto.playerViewportX } : {}),
        ...(typeof dto.playerViewportY === 'number' ? { playerViewportY: dto.playerViewportY } : {}),
        ...(typeof dto.playerViewportZoom === 'number' ? { playerViewportZoom: dto.playerViewportZoom } : {}),
      },
    });
  }
}
