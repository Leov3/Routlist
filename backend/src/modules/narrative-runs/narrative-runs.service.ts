import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NarrativeRunEventType,
  NarrativeRunStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../shared/types/authenticated-user';
import { ElevenLabsService } from '../integrations/elevenlabs/elevenlabs.service';
import { CreateNarrativeRunDto } from './dto/create-narrative-run.dto';
import { CreateRunEventDto } from './dto/create-run-event.dto';
import { GenerateDynamicAudioDto } from './dto/generate-dynamic-audio.dto';
import { UpdateCurrentNodeDto } from './dto/update-current-node.dto';
import { validateNarrativeGraph } from '../narratives/narrative-graph';

const RUNNING_STATUS: NarrativeRunStatus = 'RUNNING';
const COMPLETED_STATUS: NarrativeRunStatus = 'COMPLETED';
const CANCELLED_STATUS: NarrativeRunStatus = 'CANCELLED';

type NarrativeRunRecord = Awaited<ReturnType<NarrativeRunsService['findOne']>>;

@Injectable()
export class NarrativeRunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly elevenLabsService: ElevenLabsService,
  ) {}

  async listActive(user: AuthenticatedUser) {
    return this.prisma.narrativeRun.findMany({
      where: {
        organizationId: user.organizationId,
        status: RUNNING_STATUS,
      },
      orderBy: [{ startedAt: 'desc' }],
      include: {
        narrative: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        narrativeVersion: {
          select: {
            id: true,
            versionNumber: true,
            status: true,
          },
        },
      },
    });
  }

  async findOne(user: AuthenticatedUser, id: string) {
    return this.getRunOrThrow(user, id);
  }

  async create(
    user: AuthenticatedUser,
    narrativeId: string,
    dto: CreateNarrativeRunDto,
  ) {
    const narrative = await this.prisma.narrative.findFirst({
      where: {
        id: narrativeId,
        organizationId: user.organizationId,
      },
      include: {
        publishedVersion: true,
      },
    });

    if (!narrative) {
      throw new NotFoundException('Narrative not found');
    }

    if (
      narrative.status !== 'ACTIVE' ||
      !narrative.publishedVersionId ||
      !narrative.publishedVersion
    ) {
      throw new BadRequestException(
        'Narrative must be published before it can run',
      );
    }

    const validation = validateNarrativeGraph(
      narrative.publishedVersion.graphJson,
    );
    if (!validation.valid) {
      throw new BadRequestException(validation.errors);
    }

    const startNodeId = this.resolveStartingNodeId(
      narrative.publishedVersion.graphJson,
      dto.startingNodeId,
    );

    return this.prisma.$transaction(async (tx) => {
      const run = await tx.narrativeRun.create({
        data: {
          narrativeId: narrative.id,
          narrativeVersionId: narrative.publishedVersionId!,
          organizationId: user.organizationId,
          startedByUserId: user.id,
          status: RUNNING_STATUS,
          currentNodeId: startNodeId,
        },
      });

      await tx.narrativeRunEvent.create({
        data: {
          narrativeRunId: run.id,
          nodeId: startNodeId,
          eventType: NarrativeRunEventType.NODE_STARTED,
          payload: {
            startingNodeId: startNodeId,
          },
        },
      });

      return run;
    });
  }

  async updateCurrentNode(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateCurrentNodeDto,
  ) {
    const run = await this.getRunOrThrow(user, id);
    this.assertRunning(run.status);
    this.assertNodeExists(run, dto.currentNodeId);

    return this.prisma.narrativeRun.update({
      where: { id: run.id },
      data: {
        currentNodeId: dto.currentNodeId,
      },
    });
  }

  async recordEvent(
    user: AuthenticatedUser,
    id: string,
    dto: CreateRunEventDto,
  ) {
    const run = await this.getRunOrThrow(user, id);
    this.assertRunning(run.status);
    this.assertNodeExists(run, dto.nodeId);

    return this.prisma.narrativeRunEvent.create({
      data: {
        narrativeRunId: run.id,
        nodeId: dto.nodeId,
        eventType: dto.eventType,
        ...(dto.payload
          ? { payload: dto.payload as Prisma.InputJsonValue }
          : {}),
      },
    });
  }

  async generateDynamicAudio(
    user: AuthenticatedUser,
    id: string,
    dto: GenerateDynamicAudioDto,
  ) {
    const run = await this.getRunOrThrow(user, id);
    this.assertRunning(run.status);

    return this.elevenLabsService.generateTestAudio(user, dto);
  }

  async complete(user: AuthenticatedUser, id: string) {
    const run = await this.getRunOrThrow(user, id);
    this.assertRunning(run.status);

    await this.prisma.narrativeRunEvent.create({
      data: {
        narrativeRunId: run.id,
        nodeId: run.currentNodeId ?? 'run',
        eventType: NarrativeRunEventType.RUN_COMPLETED,
      },
    });

    return this.prisma.narrativeRun.update({
      where: { id: run.id },
      data: {
        status: COMPLETED_STATUS,
        finishedAt: new Date(),
      },
    });
  }

  async cancel(user: AuthenticatedUser, id: string) {
    const run = await this.getRunOrThrow(user, id);
    this.assertRunning(run.status);

    await this.prisma.narrativeRunEvent.create({
      data: {
        narrativeRunId: run.id,
        nodeId: run.currentNodeId ?? 'run',
        eventType: NarrativeRunEventType.RUN_CANCELLED,
      },
    });

    return this.prisma.narrativeRun.update({
      where: { id: run.id },
      data: {
        status: CANCELLED_STATUS,
        finishedAt: new Date(),
      },
    });
  }

  private async getRunOrThrow(user: AuthenticatedUser, id: string) {
    const run = await this.prisma.narrativeRun.findFirst({
      where: {
        id,
        organizationId: user.organizationId,
      },
      include: {
        narrative: {
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
          },
        },
        narrativeVersion: {
          select: {
            id: true,
            versionNumber: true,
            status: true,
            graphJson: true,
          },
        },
        events: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!run) {
      throw new NotFoundException('Narrative run not found');
    }

    return run;
  }

  private assertRunning(status: NarrativeRunStatus) {
    if (status !== RUNNING_STATUS) {
      throw new BadRequestException('Narrative run is not active');
    }
  }

  private assertNodeExists(run: NarrativeRunRecord, nodeId: string) {
    const validation = validateNarrativeGraph(run.narrativeVersion.graphJson);
    if (!validation.valid) {
      throw new BadRequestException(validation.errors);
    }

    const graph = run.narrativeVersion.graphJson as {
      nodes?: Array<{ id?: string }>;
    };

    const nodeExists = Array.isArray(graph.nodes)
      ? graph.nodes.some((node) => node.id === nodeId)
      : false;

    if (!nodeExists) {
      throw new BadRequestException(
        `Node ${nodeId} does not exist in this narrative`,
      );
    }
  }

  private resolveStartingNodeId(
    graphJson: Prisma.JsonValue,
    requestedNodeId?: string,
  ) {
    const graph = graphJson as {
      nodes?: Array<{ id?: string; type?: string }>;
      edges?: Array<{ source?: string; target?: string }>;
    };

    if (requestedNodeId) {
      const found = Array.isArray(graph.nodes)
        ? graph.nodes.some((node) => node.id === requestedNodeId)
        : false;

      if (!found) {
        throw new BadRequestException(
          `Requested start node ${requestedNodeId} does not exist`,
        );
      }

      return requestedNodeId;
    }

    const startNode = Array.isArray(graph.nodes)
      ? graph.nodes.find((node) => node.type === 'START' && node.id)
      : undefined;

    if (!startNode?.id) {
      throw new BadRequestException(
        'Published narrative does not contain a START node',
      );
    }

    const firstEdge = Array.isArray(graph.edges)
      ? graph.edges.find((edge) => edge.source === startNode.id && edge.target)
      : undefined;

    return firstEdge?.target ?? startNode.id;
  }
}
