import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../../shared/types/authenticated-user';
import { decryptSecret, encryptSecret, maskSecret } from './elevenlabs.crypto';
import type {
  ElevenLabsConnectionStatus,
  ElevenLabsConnectionStatusResponse,
  ElevenLabsGenerateAudioResponse,
  ElevenLabsSettingsResponse,
  ElevenLabsVoiceListResponse,
  ElevenLabsVoiceSummary,
} from './elevenlabs.types';
import {
  ElevenLabsSettingsDto,
  GenerateElevenLabsAudioDto,
} from './dto/elevenlabs-settings.dto';

const DEFAULT_BASE_URL = 'https://api.elevenlabs.io';
const DEFAULT_MODEL_ID = 'eleven_multilingual_v2';
const DEFAULT_OUTPUT_FORMAT = 'mp3_44100_128';
const DEFAULT_STABILITY = 0.5;
const DEFAULT_SIMILARITY_BOOST = 0.75;
const DEFAULT_STYLE = 0;
const DEFAULT_SPEED = 1;

type DraftSettings = Partial<ElevenLabsSettingsDto> & {
  text?: string;
};

type ElevenLabsIntegrationSettingRecord = {
  id: string;
  organizationId: string;
  isActive: boolean;
  apiKeyEncrypted: string | null;
  apiKeyIv: string | null;
  apiKeyAuthTag: string | null;
  apiKeyLast4: string | null;
  baseUrl: string;
  defaultVoiceId: string | null;
  defaultModelId: string;
  defaultOutputFormat: string;
  stability: number;
  similarityBoost: number;
  style: number;
  speed: number;
  speakerBoost: boolean;
  connectionStatus: string;
  lastTestAt: Date | null;
  lastTestMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ResolvedSettings = {
  apiKey: string;
  baseUrl: string;
  defaultVoiceId: string | null;
  defaultModelId: string;
  defaultOutputFormat: string;
  stability: number;
  similarityBoost: number;
  style: number;
  speed: number;
  speakerBoost: boolean;
};

@Injectable()
export class ElevenLabsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async getSettings(
    user: AuthenticatedUser,
  ): Promise<ElevenLabsSettingsResponse> {
    const settings = await this.findSettings(user.organizationId);
    return this.toResponse(settings);
  }

  async updateSettings(user: AuthenticatedUser, dto: ElevenLabsSettingsDto) {
    const existing = await this.findSettings(user.organizationId);
    if (!existing && !dto.apiKey) {
      throw new BadRequestException(
        'Debes enviar una API key para crear la integración.',
      );
    }

    const normalizedBaseUrl = this.normalizeBaseUrl(
      dto.baseUrl ?? existing?.baseUrl ?? DEFAULT_BASE_URL,
    );
    const shouldRotateKey =
      typeof dto.apiKey === 'string' && dto.apiKey.trim().length > 0;
    const nextSecretKey = this.integrationSecretKey();
    const encrypted = shouldRotateKey
      ? encryptSecret(dto.apiKey!.trim(), nextSecretKey)
      : existing
        ? {
            encrypted: existing.apiKeyEncrypted ?? null,
            iv: existing.apiKeyIv ?? null,
            authTag: existing.apiKeyAuthTag ?? null,
          }
        : null;

    const connectionStatus = this.computeStatus({
      hasSecret: Boolean(encrypted?.encrypted),
      isActive: dto.isActive ?? existing?.isActive ?? true,
      currentStatus:
        (existing?.connectionStatus as ElevenLabsConnectionStatus) ??
        'NOT_CONFIGURED',
      apiKeyChanged: shouldRotateKey,
    });

    const payload = {
      organizationId: user.organizationId,
      isActive: dto.isActive ?? existing?.isActive ?? true,
      apiKeyEncrypted: encrypted?.encrypted ?? null,
      apiKeyIv: encrypted?.iv ?? null,
      apiKeyAuthTag: encrypted?.authTag ?? null,
      apiKeyLast4: shouldRotateKey
        ? dto.apiKey!.trim().slice(-4)
        : (existing?.apiKeyLast4 ?? null),
      baseUrl: normalizedBaseUrl,
      defaultVoiceId: dto.defaultVoiceId ?? existing?.defaultVoiceId ?? null,
      defaultModelId:
        dto.defaultModelId ?? existing?.defaultModelId ?? DEFAULT_MODEL_ID,
      defaultOutputFormat:
        dto.defaultOutputFormat ??
        existing?.defaultOutputFormat ??
        DEFAULT_OUTPUT_FORMAT,
      stability:
        typeof dto.stability === 'number'
          ? dto.stability
          : (existing?.stability ?? DEFAULT_STABILITY),
      similarityBoost:
        typeof dto.similarityBoost === 'number'
          ? dto.similarityBoost
          : (existing?.similarityBoost ?? DEFAULT_SIMILARITY_BOOST),
      style:
        typeof dto.style === 'number'
          ? dto.style
          : (existing?.style ?? DEFAULT_STYLE),
      speed:
        typeof dto.speed === 'number'
          ? dto.speed
          : (existing?.speed ?? DEFAULT_SPEED),
      speakerBoost:
        typeof dto.speakerBoost === 'boolean'
          ? dto.speakerBoost
          : (existing?.speakerBoost ?? true),
      connectionStatus,
      lastTestMessage:
        shouldRotateKey && dto.isActive !== false
          ? 'Pendiente de validación'
          : (existing?.lastTestMessage ?? null),
    };

    const settings = existing
      ? await this.prisma.elevenLabsIntegrationSetting.update({
          where: {
            organizationId: user.organizationId,
          },
          data: payload,
        })
      : await this.prisma.elevenLabsIntegrationSetting.create({
          data: payload,
        });

    return this.toResponse(settings);
  }

  async deleteSettings(user: AuthenticatedUser) {
    await this.prisma.elevenLabsIntegrationSetting.deleteMany({
      where: { organizationId: user.organizationId },
    });
    return { ok: true };
  }

  async testConnection(user: AuthenticatedUser, dto?: DraftSettings) {
    const current = await this.findSettings(user.organizationId);
    const resolved = await this.resolveSettings(
      user.organizationId,
      dto,
      current,
    );
    const testResult = await this.performConnectionCheck(resolved);

    if (!dto || this.isEmptyDraft(dto)) {
      await this.prisma.elevenLabsIntegrationSetting.update({
        where: { organizationId: user.organizationId },
        data: {
          connectionStatus: 'CONNECTED',
          lastTestAt: new Date(),
          lastTestMessage: testResult.message,
          isActive: true,
        },
      });
    }

    return testResult;
  }

  async listVoices(user: AuthenticatedUser) {
    const current = await this.findSettings(user.organizationId);
    const resolved = await this.resolveSettings(
      user.organizationId,
      undefined,
      current,
    );
    const response = await this.requestJson<{
      voices?: Array<Record<string, unknown>>;
      next_page_token?: string | null;
      total_count?: number | null;
    }>(resolved, '/v1/voices?include_total_count=true&page_size=100', 'GET');

    const voices = (response.voices ?? []).map((voice) => this.mapVoice(voice));

    return {
      voices,
      nextPageToken: response.next_page_token ?? null,
      totalCount:
        typeof response.total_count === 'number' ? response.total_count : null,
    } satisfies ElevenLabsVoiceListResponse;
  }

  async generateTestAudio(
    user: AuthenticatedUser,
    dto: GenerateElevenLabsAudioDto,
  ): Promise<ElevenLabsGenerateAudioResponse> {
    const generated = await this.generateAudioBuffer(user, dto);

    return {
      fileName: generated.fileName,
      contentType: generated.contentType,
      sizeBytes: generated.buffer.length,
      audioBase64: generated.buffer.toString('base64'),
    };
  }

  async generateAudioBuffer(
    user: AuthenticatedUser,
    dto: GenerateElevenLabsAudioDto,
  ): Promise<{ buffer: Buffer; contentType: string; fileName: string }> {
    const current = await this.findSettings(user.organizationId);
    const resolved = await this.resolveSettings(
      user.organizationId,
      dto,
      current,
    );
    const voiceId = dto.defaultVoiceId ?? resolved.defaultVoiceId;

    if (!voiceId) {
      throw new BadRequestException(
        'Debes seleccionar una voz por defecto antes de generar audio.',
      );
    }

    const text = dto.text?.trim() || 'Prueba de audio generada desde Routlis.';
    const buffer = await this.requestAudio(resolved, voiceId, text);
    const contentType = this.contentTypeForOutputFormat(
      resolved.defaultOutputFormat,
    );

    return {
      buffer,
      contentType,
      fileName: `elevenlabs-test-${Date.now()}.${this.extensionForOutputFormat(resolved.defaultOutputFormat)}`,
    };
  }

  async refreshConnectionStatus(user: AuthenticatedUser) {
    const current = await this.findSettings(user.organizationId);
    if (!current) {
      return this.toResponse(null);
    }

    const resolved = await this.resolveSettings(
      user.organizationId,
      undefined,
      current,
    );
    try {
      const result = await this.performConnectionCheck(resolved);
      await this.prisma.elevenLabsIntegrationSetting.update({
        where: { organizationId: user.organizationId },
        data: {
          connectionStatus: 'CONNECTED',
          lastTestAt: new Date(),
          lastTestMessage: result.message,
          isActive: true,
        },
      });
      return result;
    } catch (error) {
      if (current) {
        await this.prisma.elevenLabsIntegrationSetting.update({
          where: { organizationId: user.organizationId },
          data: {
            connectionStatus: 'ERROR',
            lastTestAt: new Date(),
            lastTestMessage:
              error instanceof Error ? error.message : 'Error desconocido',
          },
        });
      }
      throw error;
    }
  }

  private async findSettings(organizationId: string) {
    return this.prisma.elevenLabsIntegrationSetting.findUnique({
      where: { organizationId },
    }) as Promise<ElevenLabsIntegrationSettingRecord | null>;
  }

  private async resolveSettings(
    organizationId: string,
    dto?: DraftSettings,
    current?: ElevenLabsIntegrationSettingRecord | null,
  ): Promise<ResolvedSettings> {
    const source = current ?? (await this.findSettings(organizationId));
    const hasDraftSecret =
      typeof dto?.apiKey === 'string' && dto.apiKey.trim().length > 0;

    if (!source && !hasDraftSecret) {
      throw new BadRequestException(
        'La integración de ElevenLabs no está configurada.',
      );
    }

    const apiKey = hasDraftSecret
      ? dto.apiKey!.trim()
      : this.decryptStoredKey(source);

    if (!apiKey) {
      throw new BadRequestException(
        'La API key de ElevenLabs no está configurada.',
      );
    }

    return {
      apiKey,
      baseUrl: this.normalizeBaseUrl(
        dto?.baseUrl ?? source?.baseUrl ?? DEFAULT_BASE_URL,
      ),
      defaultVoiceId: dto?.defaultVoiceId ?? source?.defaultVoiceId ?? null,
      defaultModelId:
        dto?.defaultModelId ?? source?.defaultModelId ?? DEFAULT_MODEL_ID,
      defaultOutputFormat:
        dto?.defaultOutputFormat ??
        source?.defaultOutputFormat ??
        DEFAULT_OUTPUT_FORMAT,
      stability:
        typeof dto?.stability === 'number'
          ? dto.stability
          : (source?.stability ?? DEFAULT_STABILITY),
      similarityBoost:
        typeof dto?.similarityBoost === 'number'
          ? dto.similarityBoost
          : (source?.similarityBoost ?? DEFAULT_SIMILARITY_BOOST),
      style:
        typeof dto?.style === 'number'
          ? dto.style
          : (source?.style ?? DEFAULT_STYLE),
      speed:
        typeof dto?.speed === 'number'
          ? dto.speed
          : (source?.speed ?? DEFAULT_SPEED),
      speakerBoost:
        typeof dto?.speakerBoost === 'boolean'
          ? dto.speakerBoost
          : (source?.speakerBoost ?? true),
    };
  }

  private async performConnectionCheck(settings: ResolvedSettings) {
    const response = await this.requestRaw(
      settings,
      '/v1/voices?include_total_count=true&page_size=1',
      'GET',
    );

    if (!response.ok) {
      throw await this.mapRemoteError(response);
    }

    return {
      connectionStatus: 'connected' as const,
      message: 'Conexión validada correctamente.',
      checkedAt: new Date().toISOString(),
    };
  }

  private async requestAudio(
    settings: ResolvedSettings,
    voiceId: string,
    text: string,
  ) {
    const url = new URL(
      `/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
      settings.baseUrl,
    );
    url.searchParams.set('output_format', settings.defaultOutputFormat);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: this.headers(settings.apiKey),
      body: JSON.stringify({
        text,
        model_id: settings.defaultModelId,
        voice_settings: {
          stability: settings.stability,
          similarity_boost: settings.similarityBoost,
          style: settings.style,
          speed: settings.speed,
          use_speaker_boost:
            settings.speakerBoost &&
            !settings.defaultModelId.startsWith('eleven_v3'),
        },
      }),
    });

    if (!response.ok) {
      throw await this.mapRemoteError(response);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  private async requestJson<T>(
    settings: ResolvedSettings,
    path: string,
    method: 'GET' | 'POST',
    body?: unknown,
  ): Promise<T> {
    const response = await this.requestRaw(settings, path, method, body);
    if (!response.ok) {
      throw await this.mapRemoteError(response);
    }
    return (await response.json()) as T;
  }

  private async requestRaw(
    settings: ResolvedSettings,
    path: string,
    method: 'GET' | 'POST',
    body?: unknown,
  ) {
    const url = new URL(path, settings.baseUrl);
    return fetch(url.toString(), {
      method,
      headers: this.headers(settings.apiKey),
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  private headers(apiKey: string) {
    return {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    };
  }

  private async mapRemoteError(response: Response) {
    const message = await this.readRemoteMessage(response);
    const formatted =
      message || `ElevenLabs respondió con estado ${response.status}.`;

    if (response.status === 401 || response.status === 403) {
      return new UnauthorizedException(
        'La API key de ElevenLabs no es válida o no tiene permisos suficientes.',
      );
    }

    if (response.status === 404) {
      return new BadRequestException(
        'La base URL o el recurso solicitado no existen en ElevenLabs.',
      );
    }

    if (response.status === 429) {
      return new BadGatewayException(
        `ElevenLabs está limitando las peticiones: ${formatted}`,
      );
    }

    if (response.status >= 500) {
      return new ServiceUnavailableException(
        `ElevenLabs respondió con error: ${formatted}`,
      );
    }

    return new BadGatewayException(formatted);
  }

  private async readRemoteMessage(response: Response) {
    const contentType = response.headers.get('content-type') ?? '';

    try {
      if (contentType.includes('application/json')) {
        const body = (await response.json()) as {
          message?: string;
          detail?: string;
        };
        return body.message ?? body.detail ?? null;
      }

      const text = await response.text();
      return text.trim() || null;
    } catch {
      return null;
    }
  }

  private mapVoice(voice: Record<string, unknown>): ElevenLabsVoiceSummary {
    const voiceId =
      typeof voice.voice_id === 'string'
        ? voice.voice_id
        : typeof voice.voiceId === 'string'
          ? voice.voiceId
          : typeof voice.id === 'string'
            ? voice.id
            : '';
    const name = typeof voice.name === 'string' ? voice.name : 'Sin nombre';
    const category = typeof voice.category === 'string' ? voice.category : null;
    const previewUrl =
      typeof voice.preview_url === 'string' ? voice.preview_url : null;

    return {
      voiceId,
      name,
      category,
      labels: this.toStringMap(voice.labels),
      previewUrl,
    };
  }

  private toStringMap(value: unknown): Record<string, string> | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    return Object.entries(value as Record<string, unknown>).reduce<
      Record<string, string>
    >((acc, [key, current]) => {
      if (typeof current === 'string') {
        acc[key] = current;
      }
      return acc;
    }, {});
  }

  private toResponse(
    settings: ElevenLabsIntegrationSettingRecord | null,
  ): ElevenLabsSettingsResponse {
    const hasKey = Boolean(settings?.apiKeyEncrypted);
    const rawStatus: ElevenLabsConnectionStatus = !settings
      ? 'NOT_CONFIGURED'
      : !hasKey
        ? 'NOT_CONFIGURED'
        : settings.isActive
          ? ((settings.connectionStatus as ElevenLabsConnectionStatus) ??
            'PENDING')
          : 'INACTIVE';
    const connectionStatus = this.normalizeStatus(rawStatus);

    return {
      isActive: settings?.isActive ?? false,
      connectionStatus,
      apiKeyConfigured: hasKey,
      apiKeyMasked: maskSecret(settings?.apiKeyLast4 ?? null),
      baseUrl: settings?.baseUrl ?? DEFAULT_BASE_URL,
      defaultVoiceId: settings?.defaultVoiceId ?? null,
      defaultModelId: settings?.defaultModelId ?? DEFAULT_MODEL_ID,
      defaultOutputFormat:
        settings?.defaultOutputFormat ?? DEFAULT_OUTPUT_FORMAT,
      stability: settings?.stability ?? DEFAULT_STABILITY,
      similarityBoost: settings?.similarityBoost ?? DEFAULT_SIMILARITY_BOOST,
      style: settings?.style ?? DEFAULT_STYLE,
      speed: settings?.speed ?? DEFAULT_SPEED,
      speakerBoost: settings?.speakerBoost ?? true,
      lastTestAt: settings?.lastTestAt
        ? settings.lastTestAt.toISOString()
        : null,
      lastTestMessage: settings?.lastTestMessage ?? null,
    };
  }

  private normalizeStatus(
    value: ElevenLabsConnectionStatus,
  ): ElevenLabsConnectionStatusResponse {
    const map: Record<
      ElevenLabsConnectionStatus,
      ElevenLabsConnectionStatusResponse
    > = {
      NOT_CONFIGURED: 'not_configured',
      PENDING: 'pending',
      CONNECTED: 'connected',
      ERROR: 'error',
      INACTIVE: 'inactive',
    };

    return map[value] ?? 'not_configured';
  }

  private computeStatus({
    hasSecret,
    isActive,
    currentStatus,
    apiKeyChanged,
  }: {
    hasSecret: boolean;
    isActive: boolean;
    currentStatus: ElevenLabsConnectionStatus;
    apiKeyChanged: boolean;
  }): ElevenLabsConnectionStatus {
    if (!hasSecret) return 'NOT_CONFIGURED';
    if (!isActive) return 'INACTIVE';
    if (apiKeyChanged) return 'PENDING';
    return currentStatus === 'CONNECTED' ? 'CONNECTED' : 'PENDING';
  }

  private decryptStoredKey(
    settings: ElevenLabsIntegrationSettingRecord | null,
  ) {
    if (
      !settings?.apiKeyEncrypted ||
      !settings.apiKeyIv ||
      !settings.apiKeyAuthTag
    ) {
      return null;
    }

    try {
      return decryptSecret(
        settings.apiKeyEncrypted,
        settings.apiKeyIv,
        settings.apiKeyAuthTag,
        this.integrationSecretKey(),
      );
    } catch {
      throw new BadRequestException(
        'La API key guardada no se pudo descifrar. Reemplázala para continuar.',
      );
    }
  }

  private integrationSecretKey() {
    return (
      this.configService.get<string>('integration.encryptionKey') ??
      this.configService.get<string>('auth.jwtSecret') ??
      'change-me'
    );
  }

  private normalizeBaseUrl(value: string) {
    try {
      const url = new URL(value);
      return url.toString().replace(/\/+$/, '');
    } catch {
      throw new BadRequestException('La base URL de ElevenLabs no es válida.');
    }
  }

  private contentTypeForOutputFormat(outputFormat: string) {
    if (outputFormat.startsWith('wav')) return 'audio/wav';
    if (outputFormat.startsWith('pcm')) return 'audio/wav';
    if (outputFormat.startsWith('mp3')) return 'audio/mpeg';
    return 'application/octet-stream';
  }

  private extensionForOutputFormat(outputFormat: string) {
    if (outputFormat.startsWith('wav')) return 'wav';
    if (outputFormat.startsWith('pcm')) return 'wav';
    return 'mp3';
  }

  private isEmptyDraft(dto?: DraftSettings) {
    if (!dto) return true;
    return !Object.entries(dto).some(
      ([, value]) => value !== undefined && value !== null && value !== '',
    );
  }
}
