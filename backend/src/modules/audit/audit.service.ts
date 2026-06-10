import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../shared/types/authenticated-user';
import { PlaybackEventsQueryDto } from './dto/playback-events-query.dto';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  playbackEvents(user: AuthenticatedUser, query: PlaybackEventsQueryDto) {
    const where: Prisma.PlaybackEventWhereInput = {
      organizationId: user.organizationId,
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.audioAssetId ? { audioAssetId: query.audioAssetId } : {}),
      ...(query.categoryId
        ? { audioButton: { categoryId: query.categoryId } }
        : {}),
      ...(query.from || query.to
        ? {
            startedAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    return this.prisma.playbackEvent.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: 100,
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        audioAsset: { select: { id: true, originalName: true, fileName: true } },
        audioButton: {
          select: {
            id: true,
            label: true,
            category: { select: { id: true, name: true } },
          },
        },
      },
    });
  }
}
