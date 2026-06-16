import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { encryptSecret, decryptSecret } from './mail.crypto';
import { DEFAULT_MAIL_FROM_EMAIL, DEFAULT_MAIL_FROM_NAME, DEFAULT_MAIL_PROVIDER, MAIL_SETTINGS_SINGLETON_ID } from './mail.constants';
import type { ResolvedMailSettings } from './mail.types';
import type { UpdateMailSettingsDto } from './dto/update-mail-settings.dto';

@Injectable()
export class MailSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async getSettings() {
    const record = await this.prisma.systemMailSettings.findUnique({
      where: { id: MAIL_SETTINGS_SINGLETON_ID },
    });

    return this.toResponse(record ?? (await this.createDefault()));
  }

  async updateSettings(dto: UpdateMailSettingsDto, updatedByUserId?: string) {
    const existing = await this.prisma.systemMailSettings.findUnique({
      where: { id: MAIL_SETTINGS_SINGLETON_ID },
    });
    const secretKey = this.integrationSecretKey();
    const encryptedPassword = dto.smtpPassword
      ? encryptSecret(dto.smtpPassword, secretKey)
      : existing?.smtpPasswordEncrypted
        ? {
            encrypted: existing.smtpPasswordEncrypted,
            iv: existing.smtpPasswordIv,
            authTag: existing.smtpPasswordAuthTag,
          }
        : null;

    const settings = await this.prisma.systemMailSettings.upsert({
      where: { id: MAIL_SETTINGS_SINGLETON_ID },
      update: {
        provider: dto.provider,
        enabled: dto.enabled,
        fromName: dto.fromName,
        fromEmail: dto.fromEmail,
        replyTo: dto.replyTo ?? null,
        smtpHost: dto.smtpHost ?? null,
        smtpPort: dto.smtpPort ?? null,
        smtpSecure: dto.smtpSecure ?? false,
        smtpUser: dto.smtpUser ?? null,
        smtpPasswordEncrypted: encryptedPassword?.encrypted ?? null,
        smtpPasswordIv: encryptedPassword?.iv ?? null,
        smtpPasswordAuthTag: encryptedPassword?.authTag ?? null,
        smtpPasswordLast4: dto.smtpPassword?.slice(-4) ?? existing?.smtpPasswordLast4 ?? null,
        updatedByUserId: updatedByUserId ?? null,
      },
      create: {
        id: MAIL_SETTINGS_SINGLETON_ID,
        provider: dto.provider,
        enabled: dto.enabled,
        fromName: dto.fromName,
        fromEmail: dto.fromEmail,
        replyTo: dto.replyTo ?? null,
        smtpHost: dto.smtpHost ?? null,
        smtpPort: dto.smtpPort ?? null,
        smtpSecure: dto.smtpSecure ?? false,
        smtpUser: dto.smtpUser ?? null,
        smtpPasswordEncrypted: encryptedPassword?.encrypted ?? null,
        smtpPasswordIv: encryptedPassword?.iv ?? null,
        smtpPasswordAuthTag: encryptedPassword?.authTag ?? null,
        smtpPasswordLast4: dto.smtpPassword?.slice(-4) ?? null,
        updatedByUserId: updatedByUserId ?? null,
      },
    });

    return this.toResponse(settings);
  }

  async resolveEffectiveSettings(): Promise<ResolvedMailSettings> {
    const record = await this.prisma.systemMailSettings.findUnique({
      where: { id: MAIL_SETTINGS_SINGLETON_ID },
    });
    const envFallback = this.envFallback();
    const base = record ?? envFallback;
    const password = this.decryptPassword(base);

    return {
      provider: 'smtp',
      enabled: Boolean(base.enabled),
      fromName: base.fromName ?? DEFAULT_MAIL_FROM_NAME,
      fromEmail: base.fromEmail ?? DEFAULT_MAIL_FROM_EMAIL,
      replyTo: base.replyTo ?? null,
      smtpHost: base.smtpHost ?? null,
      smtpPort: base.smtpPort ?? null,
      smtpSecure: base.smtpSecure ?? null,
      smtpUser: base.smtpUser ?? null,
      smtpPassword: password,
    };
  }

  private async createDefault() {
    const created = await this.prisma.systemMailSettings.upsert({
      where: { id: MAIL_SETTINGS_SINGLETON_ID },
      update: {},
      create: {
        id: MAIL_SETTINGS_SINGLETON_ID,
        provider: DEFAULT_MAIL_PROVIDER,
        enabled: false,
        fromName: DEFAULT_MAIL_FROM_NAME,
        fromEmail: DEFAULT_MAIL_FROM_EMAIL,
        replyTo: null,
        smtpHost: null,
        smtpPort: null,
        smtpSecure: false,
        smtpUser: null,
        smtpPasswordEncrypted: null,
        smtpPasswordIv: null,
        smtpPasswordAuthTag: null,
        smtpPasswordLast4: null,
      },
    });

    return created;
  }

  private toResponse(record: {
    id: string;
    provider: string;
    enabled: boolean;
    fromName: string;
    fromEmail: string;
    replyTo: string | null;
    smtpHost: string | null;
    smtpPort: number | null;
    smtpSecure: boolean;
    smtpUser: string | null;
    smtpPasswordLast4: string | null;
    lastTestAt: Date | null;
    lastTestMessage: string | null;
    updatedByUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: record.id,
      provider: record.provider,
      enabled: record.enabled,
      fromName: record.fromName,
      fromEmail: record.fromEmail,
      replyTo: record.replyTo,
      smtpHost: record.smtpHost,
      smtpPort: record.smtpPort,
      smtpSecure: record.smtpSecure,
      smtpUser: record.smtpUser,
      smtpPasswordLast4: record.smtpPasswordLast4,
      lastTestAt: record.lastTestAt,
      lastTestMessage: record.lastTestMessage,
      updatedByUserId: record.updatedByUserId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private envFallback(): {
    provider: string;
    enabled: boolean;
    fromName: string;
    fromEmail: string;
    replyTo: string | null;
    smtpHost: string | null;
    smtpPort: number | null;
    smtpSecure: boolean;
    smtpUser: string | null;
    smtpPasswordEncrypted: string | null;
    smtpPasswordIv: string | null;
    smtpPasswordAuthTag: string | null;
    smtpPasswordLast4: string | null;
  } {
    return {
      provider: DEFAULT_MAIL_PROVIDER,
      enabled: this.configService.get<string>('mail.enabled') === 'true',
      fromName: this.configService.get<string>('mail.fromName') ?? DEFAULT_MAIL_FROM_NAME,
      fromEmail: this.configService.get<string>('mail.fromEmail') ?? DEFAULT_MAIL_FROM_EMAIL,
      replyTo: this.configService.get<string>('mail.replyTo') ?? null,
      smtpHost: this.configService.get<string>('mail.smtpHost') ?? null,
      smtpPort: this.configService.get<number>('mail.smtpPort') ?? null,
      smtpSecure: this.configService.get<string>('mail.smtpSecure') === 'true',
      smtpUser: this.configService.get<string>('mail.smtpUser') ?? null,
      smtpPasswordEncrypted: null,
      smtpPasswordIv: null,
      smtpPasswordAuthTag: null,
      smtpPasswordLast4: null,
    };
  }

  private decryptPassword(base: {
    smtpPasswordEncrypted: string | null;
    smtpPasswordIv: string | null;
    smtpPasswordAuthTag: string | null;
    smtpUser: string | null;
    smtpHost: string | null;
    smtpPort: number | null;
    smtpSecure: boolean | null;
    enabled: boolean;
    fromName: string;
    fromEmail: string;
    replyTo: string | null;
  }) {
    if (
      base.smtpPasswordEncrypted &&
      base.smtpPasswordIv &&
      base.smtpPasswordAuthTag
    ) {
      try {
        return decryptSecret(
          base.smtpPasswordEncrypted,
          base.smtpPasswordIv,
          base.smtpPasswordAuthTag,
          this.integrationSecretKey(),
        );
      } catch {
        return null;
      }
    }

    return this.configService.get<string>('mail.smtpPassword') ?? null;
  }

  private integrationSecretKey() {
    return (
      this.configService.get<string>('integration.encryptionKey') ??
      this.configService.get<string>('auth.jwtSecret') ??
      'change-me'
    );
  }
}
