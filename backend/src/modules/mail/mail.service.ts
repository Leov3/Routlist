import { ForbiddenException, Injectable } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../shared/types/authenticated-user';
import { PASSWORD_RESET_TTL_MINUTES, INVITE_TTL_HOURS } from './mail.constants';
import { MailAuditService } from './mail-audit.service';
import { MailSettingsService } from './mail-settings.service';
import { MailTemplateService } from './mail-template.service';
import { SmtpMailProvider } from './providers/smtp-mail.provider';
import type { MailRenderContext, MailSendResult, MailTemplateType } from './mail.types';

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

  async testMail(user: AuthenticatedUser, to: string, subject?: string) {
    return this.sendTemplate({
      type: 'TEST',
      to,
      organizationId: user.organizationId,
      userId: user.id,
      context: {},
      subjectOverride: subject,
    });
  }

  async listLogs(limit = 50) {
    return this.prisma.mailDeliveryLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async listOrganizationInvites(currentUser: AuthenticatedUser, organizationId: string) {
    await this.ensureOrganizationAccess(currentUser, organizationId);

    return this.prisma.organizationInvite.findMany({
      where: { organizationId },
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
    input: { email: string; role: string },
  ) {
    const organization = await this.prisma.organization.findFirst({
      where: { id: organizationId, status: 'ACTIVE' },
      select: { id: true, name: true },
    });

    if (!organization) {
      return { ok: false };
    }

    const token = this.generateToken();
    const tokenHash = this.hashToken(token);
    const invite = await this.prisma.organizationInvite.create({
      data: {
        organizationId,
        email: input.email.toLowerCase(),
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
        actionUrl,
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
        status: 'PENDING',
      },
      create: {
        organizationId: invite.organizationId,
        userId: user.id,
        roleId: role.id,
        status: 'PENDING',
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
        actionUrl,
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

  private async sendTemplate(input: {
    type: MailTemplateType;
    to: string;
    subjectOverride?: string;
    organizationId?: string;
    userId?: string;
    context: MailRenderContext;
  }): Promise<MailSendResult> {
    const settings = await this.settingsService.resolveEffectiveSettings();
    const template = this.templateService.render(input.type, {
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
        html: template.html,
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
        context: input.context,
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
        context: input.context,
      });
      return { ok: false, error: error instanceof Error ? error.message : 'Mail error' };
    }
  }

  private generateToken() {
    return randomBytes(32).toString('hex');
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private buildFrontendUrl(path: string) {
    const base = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    return `${base.replace(/\/+$/, '')}${path}`;
  }

  private async ensureOrganizationAccess(currentUser: AuthenticatedUser, organizationId: string) {
    if (currentUser.role === 'OWNER' || currentUser.organizationId === organizationId) {
      return;
    }

    throw new ForbiddenException('No tienes acceso a esta organización');
  }
}
