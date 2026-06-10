import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../shared/types/authenticated-user';
import { RecentPlaybackEventsQueryDto } from './dto/recent-playback-events-query.dto';
import { StartPlaybackEventDto } from './dto/start-playback-event.dto';
import { StopPlaybackEventDto } from './dto/stop-playback-event.dto';

@Injectable()
export class PlaybackService {
  constructor(private readonly prisma: PrismaService) {}

  async start(user: AuthenticatedUser, dto: StartPlaybackEventDto) {
    const button = await this.prisma.audioButton.findFirst({
      where: {
        id: dto.audioButtonId,
        organizationId: user.organizationId,
        isActive: true,
        audioAsset: { isActive: true },
      },
      include: { audioAsset: true },
    });

    if (!button) {
      throw new NotFoundException('Audio button not found');
    }

    return this.prisma.playbackEvent.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        audioButtonId: button.id,
        audioAssetId: button.audioAssetId,
        playbackMode: dto.playbackMode ?? 'LOCAL_BROWSER',
        contextType: dto.contextType ?? 'NONE',
        contextId: dto.contextId,
      },
    });
  }

  async stop(user: AuthenticatedUser, id: string, dto: StopPlaybackEventDto) {
    const event = await this.prisma.playbackEvent.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
    });

    if (!event) {
      throw new NotFoundException('Playback event not found');
    }

    return this.prisma.playbackEvent.update({
      where: { id },
      data: {
        stoppedAt: new Date(),
        durationPlayedSeconds: dto.durationPlayedSeconds,
      },
    });
  }

  recent(user: AuthenticatedUser, query: RecentPlaybackEventsQueryDto) {
    const take = query.limit ?? 10;
    const where = {
      organizationId: user.organizationId,
      ...(query.scope === 'user' ? { userId: user.id } : {}),
    };

    return this.prisma.playbackEvent.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take,
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
