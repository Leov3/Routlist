import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../shared/types/authenticated-user';
import { UpdateBoardPreferencesDto } from './dto/update-board-preferences.dto';

const DEFAULT_PREFERENCES = {
  viewMode: 'simple',
  density: 'medium',
  volume: 1,
} as const;

@Injectable()
export class BoardPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async get(user: AuthenticatedUser) {
    const preferences = await this.prisma.userBoardPreference.findUnique({
      where: {
        organizationId_userId: {
          organizationId: user.organizationId,
          userId: user.id,
        },
      },
    });

    return preferences ?? { ...DEFAULT_PREFERENCES };
  }

  async update(user: AuthenticatedUser, dto: UpdateBoardPreferencesDto) {
    const preferences = await this.prisma.userBoardPreference.upsert({
      where: {
        organizationId_userId: {
          organizationId: user.organizationId,
          userId: user.id,
        },
      },
      create: {
        organizationId: user.organizationId,
        userId: user.id,
        viewMode: dto.viewMode ?? DEFAULT_PREFERENCES.viewMode,
        density: dto.density ?? DEFAULT_PREFERENCES.density,
        volume: dto.volume ?? DEFAULT_PREFERENCES.volume,
      },
      update: {
        ...(dto.viewMode ? { viewMode: dto.viewMode } : {}),
        ...(dto.density ? { density: dto.density } : {}),
        ...(typeof dto.volume === 'number' ? { volume: dto.volume } : {}),
      },
    });

    return preferences;
  }
}
