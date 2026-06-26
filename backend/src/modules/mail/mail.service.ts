import { ForbiddenException, Injectable } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../shared/types/authenticated-user';
import { PASSWORD_RESET_TTL_MINUTES, INVITE_TTL_HOURS } from './mail.constants';
import { MailAuditService } from './mail-audit.service';
import { MailSettingsService } from './mail-settings.service';
import { MailTemplateService } from './mail-template.service';
import { MAIL_VARIABLE_CATALOG } from './mail.variables';
import { SmtpMailProvider } from './providers/smtp-mail.provider';
import type { SendTemplatePreviewDto } from './dto/send-template-preview.dto';
import type {
  MailEventRecord,
  MailRenderContext,
  MailSendResult,
  MailTemplateRecord,
  MailTemplateType,
} from './mail.types';

const MAIL_TEMPLATE_SEEDS: Array<Pick<MailTemplateRecord, 'key' | 'name' | 'description' | 'subject' | 'htmlBody' | 'textBody' | 'isActive'>> = [
  {
    key: 'WELCOME',
    name: 'Bienvenida',
    description: 'Plantilla para usuarios nuevos.',
    subject: 'Bienvenido a Routlis',
    htmlBody: '<h1>Bienvenido a Routlis</h1><p>Tu cuenta ya está lista.</p>',
    textBody: 'Bienvenido a Routlis. Tu cuenta ya está lista.',
    isActive: true,
  },
  {
    key: 'INVITE',
    name: 'Invitación a organización',
    description: 'Correo de invitación a organizaciones.',
    subject: 'Te invitaron a Routlis',
    htmlBody: '<h1>Invitación</h1><p>Fuiste invitado a una organización.</p>',
    textBody: 'Fuiste invitado a una organización.',
    isActive: true,
  },
  {
    key: 'PASSWORD_RESET',
    name: 'Recuperación de contraseña',
    description: 'Correo para restablecer contraseña.',
    subject: 'Restablece tu contraseña',
    htmlBody: '<h1>Restablece tu contraseña</h1>',
    textBody: 'Restablece tu contraseña',
    isActive: true,
  },
  {
    key: 'PASSWORD_CHANGED',
    name: 'Cambio de contraseña',
    description: 'Notificación de cambio de contraseña.',
    subject: 'Tu contraseña fue actualizada',
    htmlBody: '<h1>Contraseña actualizada</h1>',
    textBody: 'Tu contraseña fue actualizada',
    isActive: true,
  },
  {
    key: 'TEST',
    name: 'Prueba de correo',
    description: 'Correo de prueba desde el panel.',
    subject: 'Prueba de correo Routlis',
    htmlBody: '<h1>Correo de prueba</h1>',
    textBody: 'Correo de prueba',
    isActive: true,
  },
];

const MAIL_EVENT_SEEDS: Array<Pick<MailEventRecord, 'key' | 'name' | 'description' | 'isEnabled' | 'templateKey' | 'channels'>> = [
  { key: 'USER_CREATED', name: 'Usuario creado', description: 'Dispara bienvenida', isEnabled: true, templateKey: 'WELCOME', channels: ['email'] },
  { key: 'INVITE_SENT', name: 'Invitación enviada', description: 'Dispara invitación', isEnabled: true, templateKey: 'INVITE', channels: ['email'] },
  { key: 'PASSWORD_RESET_REQUESTED', name: 'Recuperación de contraseña', description: 'Dispara reset', isEnabled: true, templateKey: 'PASSWORD_RESET', channels: ['email'] },
  { key: 'PASSWORD_CHANGED', name: 'Cambio de contraseña', description: 'Notifica cambio', isEnabled: true, templateKey: 'PASSWORD_CHANGED', channels: ['email'] },
  { key: 'STORAGE_HIGH', name: 'Alerta por almacenamiento alto', description: 'Alerta operativa', isEnabled: false, templateKey: null, channels: ['email'] },
  { key: 'NARRATIVE_READY', name: 'Narrativa lista', description: 'Notifica proceso completado', isEnabled: false, templateKey: null, channels: ['email'] },
  { key: 'AUDIO_PROCESSED', name: 'Audio procesado', description: 'Procesamiento correcto', isEnabled: false, templateKey: null, channels: ['email'] },
  { key: 'AUDIO_ERROR', name: 'Error de procesamiento', description: 'Procesamiento fallido', isEnabled: false, templateKey: null, channels: ['email'] },
  { key: 'LICENSE_EXPIRING', name: 'Licencia próxima a vencer', description: 'Aviso preventivo', isEnabled: false, templateKey: null, channels: ['email'] },
];

type RequestContext = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

@Injectable()
export class MailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: MailSettingsService,
    private readonly templateService: MailTemplateService,
    private readonly provider: SmtpMailProvider,
    private readonly auditService: MailAuditService,
  ) {}

  async getSettings() {
    return this.settingsService.getSettings();
  }

  async updateSettings(user: AuthenticatedUser, dto: Parameters<MailSettingsService['updateSettings']>[0]) {
    return this.settingsService.updateSettings(dto, user.id);
  }

  async listTemplates() {
    await this.ensureMailCatalogSeeded();
    return this.db().mailTemplate.findMany({ orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }] });
  }

  async upsertTemplate(user: AuthenticatedUser, input: {
    key: string;
    name: string;
    description?: string;
    subject: string;
    htmlBody: string;
    textBody?: string;
    isActive?: boolean;
  }) {
    await this.ensureMailCatalogSeeded();
    return this.db().mailTemplate.upsert({
      where: { key: input.key },
      update: {
        name: input.name,
        description: input.description ?? null,
        subject: input.subject,
        htmlBody: input.htmlBody,
        textBody: input.textBody ?? null,
        isActive: input.isActive ?? true,
        updatedByUserId: user.id,
      },
      create: {
        key: input.key,
        name: input.name,
        description: input.description ?? null,
        subject: input.subject,
        htmlBody: input.htmlBody,
        textBody: input.textBody ?? null,
        isActive: input.isActive ?? true,
        updatedByUserId: user.id,
      },
    });
  }

  async deleteTemplate(key: string) {
    return this.db().mailTemplate.delete({ where: { key } });
  }

  getVariableCatalog() {
    return MAIL_VARIABLE_CATALOG;
  }

  async repairTemplates(user: AuthenticatedUser) {
    const repaired = await Promise.all(
      MAIL_TEMPLATE_SEEDS.map((template) =>
        this.db().mailTemplate.upsert({
          where: { key: template.key },
          update: {
            name: template.name,
            description: template.description,
            subject: template.subject,
            htmlBody: template.htmlBody,
            textBody: template.textBody,
            isActive: template.isActive,
            updatedByUserId: user.id,
          },
          create: {
            ...template,
            updatedByUserId: user.id,
          },
        }),
      ),
    );

    return {
      ok: true,
      repairedCount: repaired.length,
      keys: repaired.map((template) => template.key),
    };
  }

  async listEvents() {
    await this.ensureMailCatalogSeeded();
    return this.db().mailEvent.findMany({ orderBy: [{ isEnabled: 'desc' }, { createdAt: 'asc' }] });
  }

  async updateEvent(user: AuthenticatedUser, key: string, input: { templateKey?: string; isEnabled?: boolean }) {
    await this.ensureMailCatalogSeeded();
    return this.db().mailEvent.update({
      where: { key },
      data: {
        templateKey: input.templateKey ?? null,
        isEnabled: input.isEnabled ?? true,
        updatedByUserId: user.id,
      },
    });
  }

  async listQueue() {
    return this.db().mailQueueItem.findMany({
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
    });
  }

  async enqueueMail(user: AuthenticatedUser, input: {
    to: string;
    subject: string;
    eventKey?: string;
    templateKey?: string;
  }) {
    return this.db().mailQueueItem.create({
      data: {
        to: input.to,
        subject: input.subject,
        eventKey: input.eventKey ?? null,
        templateKey: input.templateKey ?? null,
        createdByUserId: user.id,
        status: 'PENDING',
      },
    });
  }

  async retryQueueItem(user: AuthenticatedUser, id: string) {
    const item = await this.db().mailQueueItem.update({
      where: { id },
      data: {
        status: 'PENDING',
        lastError: null,
        attempts: { increment: 1 },
        updatedAt: new Date(),
        createdByUserId: user.id,
      },
    });

    return item;
  }

  async testMail(user: AuthenticatedUser, to: string, subject?: string, message?: string) {
    return this.sendTemplate({
      type: 'TEST',
      to,
      organizationId: user.organizationId,
      userId: user.id,
      context: { message: message ?? '' },
      subjectOverride: subject,
    });
  }

  async sendTemplatePreview(user: AuthenticatedUser, input: SendTemplatePreviewDto) {
    const settings = await this.settingsService.resolveEffectiveSettings();
    const subject = input.subject?.trim() || 'Plantilla de prueba';
    const renderContext = {
      ...input.context,
      fromEmail: settings.fromEmail,
      fromName: settings.fromName,
      appName: settings.fromName,
      replyTo: settings.replyTo ?? undefined,
      supportEmail: settings.replyTo ?? undefined,
    };
    const rendered = this.templateService.renderCustom(
      {
        subject,
        html: this.normalizeHtmlEmail(input.htmlBody),
        text: input.textBody?.trim() || this.htmlToPlainText(this.normalizeHtmlEmail(input.htmlBody)),
      },
      renderContext,
    );

    try {
      const result = await this.provider.sendMail(settings, {
        to: input.to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        replyTo: settings.replyTo,
      });

      await this.auditService.logSuccess({
        organizationId: user.organizationId,
        userId: user.id,
        type: 'TEST',
        to: input.to,
        subject: rendered.subject,
        providerMessageId: result.messageId ?? null,
        acceptedRecipients: result.acceptedRecipients ?? [],
        rejectedRecipients: result.rejectedRecipients ?? [],
        responseMessage: result.responseMessage ?? null,
        context: {
          templateKey: input.templateKey ?? null,
          mode: 'template-preview',
        },
      });

      return {
        ok: true,
        messageId: result.messageId,
        acceptedRecipients: result.acceptedRecipients,
        rejectedRecipients: result.rejectedRecipients,
        responseMessage: result.responseMessage ?? null,
      };
    } catch (error) {
      await this.auditService.logFailure({
        organizationId: user.organizationId,
        userId: user.id,
        type: 'TEST',
        to: input.to,
        subject: rendered.subject,
        error,
        context: {
          templateKey: input.templateKey ?? null,
          mode: 'template-preview',
        },
      });
      return { ok: false, error: error instanceof Error ? error.message : 'Mail error' };
    }
  }

  async listLogs(limit = 50) {
    return this.prisma.mailDeliveryLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async listAllOrganizationInvites(limit = 100) {
    return this.prisma.organizationInvite.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        organization: {
          select: { id: true, name: true },
        },
        invitedBy: {
          select: { id: true, fullName: true, email: true },
        },
        acceptedBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });
  }

  async listOrganizationInvites(currentUser: AuthenticatedUser, organizationId: string) {
    await this.ensureOrganizationAccess(currentUser, organizationId);

    return this.prisma.organizationInvite.findMany({
      where: { organizationId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: {
        invitedBy: {
          select: { id: true, fullName: true, email: true },
        },
        acceptedBy: {
          select: { id: true, fullName: true, email: true },
        },
        organization: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async requestPasswordReset(email: string, context: RequestContext = {}) {
    const normalized = email.toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalized },
    });

    if (!user || user.status !== 'ACTIVE') {
      return { ok: true };
    }

    const plainToken = this.generateToken();
    const tokenHash = this.hashToken(plainToken);
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000),
        requestIp: context.ipAddress ?? null,
        requestUserAgent: context.userAgent ?? null,
      },
    });

    const actionUrl = this.buildFrontendUrl(`/reset-password?token=${plainToken}`);
    await this.sendTemplate({
      type: 'PASSWORD_RESET',
      to: user.email,
      userId: user.id,
      context: {
        userName: user.fullName,
        actionUrl,
        resetUrl: actionUrl,
        expiresInMinutes: PASSWORD_RESET_TTL_MINUTES,
      },
    });

    return { ok: true };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = this.hashToken(token);
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      return { ok: false };
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      });

      await tx.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });

      await tx.userSession.updateMany({
        where: { userId: record.userId, isActive: true },
        data: {
          isActive: false,
          status: 'REVOKED',
          revokedAt: new Date(),
          revokedReason: 'password-changed',
        },
      });
    });

    await this.sendTemplate({
      type: 'PASSWORD_CHANGED',
      to: record.user.email,
      userId: record.userId,
      context: { userName: record.user.fullName },
    });

    return { ok: true };
  }

  async changePassword(currentUser: AuthenticatedUser, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.id },
    });

    if (!user) {
      return { ok: false };
    }

    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      return { ok: false };
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: currentUser.id },
      data: { passwordHash },
    });

    await this.prisma.userSession.updateMany({
      where: { userId: currentUser.id, isActive: true },
      data: {
        isActive: false,
        status: 'REVOKED',
        revokedAt: new Date(),
        revokedReason: 'password-changed',
      },
    });

    await this.sendTemplate({
      type: 'PASSWORD_CHANGED',
      to: user.email,
      userId: user.id,
      organizationId: currentUser.organizationId,
      context: { userName: user.fullName },
    });

    return { ok: true };
  }

  async createInvite(
    currentUser: AuthenticatedUser,
    organizationId: string,
    input: { email: string; role: string; inviteeName?: string },
  ) {
    const organization = await this.prisma.organization.findFirst({
      where: { id: organizationId, status: 'ACTIVE' },
      select: { id: true, name: true },
    });

    if (!organization) {
      return { ok: false };
    }

    await this.ensureUserCapacity(organizationId, { includePendingInvites: true });

    const token = this.generateToken();
    const tokenHash = this.hashToken(token);
    const invite = await this.prisma.organizationInvite.create({
      data: {
        organizationId,
        email: input.email.toLowerCase(),
        inviteeName: input.inviteeName?.trim() || null,
        role: input.role,
        tokenHash,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000),
        invitedByUserId: currentUser.id,
      },
    });

    const actionUrl = this.buildFrontendUrl(`/accept-invite?token=${token}`);
    await this.sendTemplate({
      type: 'INVITE',
      to: invite.email,
      organizationId,
      userId: currentUser.id,
      context: {
        organizationName: organization.name,
        inviterName: currentUser.fullName,
        inviteeName: input.inviteeName?.trim() || input.email,
        actionUrl,
        inviteUrl: actionUrl,
        inviteCode: token,
        expiresInHours: INVITE_TTL_HOURS,
      },
    });

    return invite;
  }

  async acceptInvite(input: { token: string; fullName: string; password: string }) {
    const tokenHash = this.hashToken(input.token);
    const invite = await this.prisma.organizationInvite.findUnique({
      where: { tokenHash },
      include: {
        organization: true,
      },
    });

    if (!invite || invite.status !== 'PENDING' || invite.expiresAt.getTime() < Date.now()) {
      return { ok: false };
    }

    await this.ensureUserCapacity(invite.organizationId, { includePendingInvites: false });

    const normalizedEmail = invite.email.toLowerCase();
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await this.prisma.user.upsert({
      where: { email: normalizedEmail },
      update: {
        fullName: input.fullName,
        passwordHash,
        status: 'ACTIVE',
      },
      create: {
        email: normalizedEmail,
        fullName: input.fullName,
        passwordHash,
        status: 'ACTIVE',
      },
    });

    const role = await this.prisma.role.findUnique({
      where: { name: invite.role },
    });

    if (!role) {
      return { ok: false };
    }

    await this.prisma.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: invite.organizationId,
          userId: user.id,
        },
      },
      update: {
        roleId: role.id,
        status: 'ACTIVE',
      },
      create: {
        organizationId: invite.organizationId,
        userId: user.id,
        roleId: role.id,
        status: 'ACTIVE',
      },
    });

    await this.prisma.organizationInvite.update({
      where: { id: invite.id },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
        acceptedByUserId: user.id,
      },
    });

    await this.sendTemplate({
      type: 'WELCOME',
      to: user.email,
      userId: user.id,
      organizationId: invite.organizationId,
      context: { userName: user.fullName },
    });

    return { ok: true };
  }

  async approveInvite(currentUser: AuthenticatedUser, organizationId: string, inviteId: string) {
    const invite = await this.prisma.organizationInvite.findFirst({
      where: { id: inviteId, organizationId },
      include: { organization: true },
    });

    if (!invite) {
      return { ok: false };
    }

    const member = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
        user: { email: invite.email },
      },
      include: { user: true },
    });

    if (!member) {
      return { ok: false };
    }

    await this.prisma.organizationMember.update({
      where: { id: member.id },
      data: { status: 'ACTIVE' },
    });

    await this.prisma.organizationInvite.update({
      where: { id: invite.id },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
        acceptedByUserId: member.userId,
      },
    });

    await this.sendTemplate({
      type: 'APPROVAL',
      to: member.user.email,
      userId: member.userId,
      organizationId,
      context: {
        userName: member.user.fullName,
        organizationName: invite.organization.name,
      },
    });

    return { ok: true };
  }

  async resendInvite(currentUser: AuthenticatedUser, organizationId: string, inviteId: string) {
    const invite = await this.prisma.organizationInvite.findFirst({
      where: { id: inviteId, organizationId },
      include: { organization: true },
    });

    if (!invite) {
      return { ok: false };
    }

    const token = this.generateToken();
    const tokenHash = this.hashToken(token);

    const updated = await this.prisma.organizationInvite.update({
      where: { id: invite.id },
      data: {
        tokenHash,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000),
      },
    });

    const actionUrl = this.buildFrontendUrl(`/accept-invite?token=${token}`);
    await this.sendTemplate({
      type: 'INVITE',
      to: updated.email,
      organizationId,
      userId: currentUser.id,
      context: {
        organizationName: invite.organization.name,
        inviterName: currentUser.fullName,
        inviteeName: invite.inviteeName ?? updated.email,
        actionUrl,
        inviteUrl: actionUrl,
        inviteCode: token,
        expiresInHours: INVITE_TTL_HOURS,
      },
    });

    return updated;
  }

  async revokeInvite(currentUser: AuthenticatedUser, organizationId: string, inviteId: string) {
    await this.ensureOrganizationAccess(currentUser, organizationId);

    const invite = await this.prisma.organizationInvite.findFirst({
      where: { id: inviteId, organizationId },
      select: { id: true, status: true },
    });

    if (!invite) {
      return { ok: false };
    }

    const status = invite.status === 'ACCEPTED' ? invite.status : 'REVOKED';
    const updated = await this.prisma.organizationInvite.update({
      where: { id: invite.id },
      data: {
        status,
        tokenHash: this.hashToken(this.generateToken()),
      },
    });

    return updated;
  }

  async rejectInvite(currentUser: AuthenticatedUser, organizationId: string, inviteId: string) {
    await this.ensureOrganizationAccess(currentUser, organizationId);

    const invite = await this.prisma.organizationInvite.findFirst({
      where: { id: inviteId, organizationId },
      select: { id: true, status: true },
    });

    if (!invite) {
      return { ok: false };
    }

    const updated = await this.prisma.organizationInvite.update({
      where: { id: invite.id },
      data: {
        status: invite.status === 'ACCEPTED' ? invite.status : 'REJECTED',
        tokenHash: this.hashToken(this.generateToken()),
      },
    });

    return updated;
  }

  private async sendTemplate(input: {
    type: MailTemplateType;
    to: string;
    subjectOverride?: string;
    organizationId?: string;
    userId?: string;
    context: MailRenderContext;
  }): Promise<MailSendResult> {
    const settings = await this.settingsService.resolveEffectiveSettings();
    const eventConfig = await this.db().mailEvent.findUnique({
      where: { key: input.type },
      select: { templateKey: true, isEnabled: true },
    });
    if (eventConfig && !eventConfig.isEnabled) {
      return { ok: true, skipped: true };
    }
    const resolvedTemplateKey = eventConfig?.templateKey?.trim() || input.type;
    const storedTemplate = await this.db().mailTemplate.findUnique({
      where: { key: resolvedTemplateKey },
    });
    const template = storedTemplate?.isActive
      ? this.templateService.renderStored(storedTemplate, {
          ...input.context,
          fromEmail: settings.fromEmail,
          fromName: settings.fromName,
          appName: settings.fromName,
          replyTo: settings.replyTo ?? undefined,
          supportEmail: settings.replyTo ?? undefined,
        })
      : this.templateService.render(input.type, {
        ...input.context,
        fromEmail: settings.fromEmail,
        fromName: settings.fromName,
        appName: settings.fromName,
        replyTo: settings.replyTo ?? undefined,
        supportEmail: settings.replyTo ?? undefined,
      });
    const subject = input.subjectOverride ?? template.subject;

    try {
      const result = await this.provider.sendMail(settings, {
        to: input.to,
        subject,
        html: this.normalizeHtmlEmail(template.html),
        text: template.text,
        replyTo: settings.replyTo,
      });

      await this.auditService.logSuccess({
        organizationId: input.organizationId,
        userId: input.userId,
        type: input.type,
        to: input.to,
        subject,
        providerMessageId: result.messageId ?? null,
        acceptedRecipients: result.acceptedRecipients ?? [],
        rejectedRecipients: result.rejectedRecipients ?? [],
        responseMessage: result.responseMessage ?? null,
        context: { ...input.context, templateKey: resolvedTemplateKey, eventKey: input.type },
      });

      return {
        ok: true,
        messageId: result.messageId,
        acceptedRecipients: result.acceptedRecipients,
        rejectedRecipients: result.rejectedRecipients,
        responseMessage: result.responseMessage ?? null,
      };
    } catch (error) {
      await this.auditService.logFailure({
        organizationId: input.organizationId,
        userId: input.userId,
        type: input.type,
        to: input.to,
        subject,
        error,
        context: { ...input.context, templateKey: resolvedTemplateKey, eventKey: input.type },
      });
      return { ok: false, error: error instanceof Error ? error.message : 'Mail error' };
    }
  }

  private async ensureMailCatalogSeeded() {
    await Promise.all([
      ...MAIL_TEMPLATE_SEEDS.map((template) =>
        this.db().mailTemplate.upsert({
          where: { key: template.key },
          update: {},
          create: template,
        }),
      ),
      ...MAIL_EVENT_SEEDS.map((event) =>
        this.db().mailEvent.upsert({
          where: { key: event.key },
          update: {},
          create: event,
        }),
      ),
    ]);
  }

  private generateToken() {
    return randomBytes(32).toString('hex');
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private buildFrontendUrl(path: string) {
    const base = process.env.FRONTEND_URL ?? 'http://localhost:3001';
    return `${base.replace(/\/+$/, '')}${path}`;
  }

  private async ensureOrganizationAccess(currentUser: AuthenticatedUser, organizationId: string) {
    if (currentUser.role === 'OWNER' || currentUser.organizationId === organizationId) {
      return;
    }

    throw new ForbiddenException('No tienes acceso a esta organización');
  }

  private async ensureUserCapacity(
    organizationId: string,
    options: { includePendingInvites?: boolean } = {},
  ) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, maxUsers: true },
    });

    if (!organization) {
      throw new ForbiddenException('Organization not found');
    }

    const activeMembers = await this.prisma.organizationMember.count({
      where: { organizationId, status: 'ACTIVE' },
    });
    const pendingInvites = options.includePendingInvites
      ? await this.prisma.organizationInvite.count({
          where: { organizationId, status: 'PENDING' },
        })
      : 0;

    if (activeMembers + pendingInvites >= organization.maxUsers) {
      throw new ForbiddenException('Organization user limit reached');
    }
  }

  private db() {
    return this.prisma as any;
  }

  private htmlToPlainText(html: string) {
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeHtmlEmail(html: string) {
    const source = String(html ?? '').trim();
    if (!source) {
      return '<!doctype html><html lang="es"><body></body></html>';
    }

    if (/<html[\s>]/i.test(source)) {
      return source;
    }

    const styleBlocks = source.match(/<style[\s\S]*?<\/style>/gi) ?? [];
    const bodyContent = source.replace(/<style[\s\S]*?<\/style>/gi, '').trim();
    const headContent = [
      '<meta charset="utf-8" />',
      '<meta name="viewport" content="width=device-width, initial-scale=1" />',
      ...styleBlocks,
    ].join('\n');

    return `<!doctype html>
<html lang="es">
  <head>
    ${headContent}
  </head>
  <body>${bodyContent}</body>
</html>`;
  }
}
