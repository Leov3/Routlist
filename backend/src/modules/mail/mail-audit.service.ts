import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { MailTemplateType } from './mail.types';

@Injectable()
export class MailAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async logSuccess(input: {
    organizationId?: string | null;
    userId?: string | null;
    type: MailTemplateType;
    to: string;
    subject: string;
    providerMessageId?: string | null;
    acceptedRecipients?: string[];
    rejectedRecipients?: string[];
    responseMessage?: string | null;
    context?: Record<string, unknown>;
  }) {
    await this.prisma.mailDeliveryLog.create({
      data: {
        organizationId: input.organizationId ?? null,
        userId: input.userId ?? null,
        type: input.type,
        to: input.to,
        subject: input.subject,
        status: 'SENT',
        providerMessageId: input.providerMessageId ?? null,
        contextJson: ({
          ...(input.context ?? {}),
          acceptedRecipients: input.acceptedRecipients ?? [],
          rejectedRecipients: input.rejectedRecipients ?? [],
          responseMessage: input.responseMessage ?? null,
        } satisfies Prisma.InputJsonValue),
      },
    });
  }

  async logFailure(input: {
    organizationId?: string | null;
    userId?: string | null;
    type: MailTemplateType;
    to: string;
    subject: string;
    error: unknown;
    context?: Record<string, unknown>;
  }) {
    const errorMessage =
      input.error instanceof Error ? input.error.message : String(input.error);
    await this.prisma.mailDeliveryLog.create({
      data: {
        organizationId: input.organizationId ?? null,
        userId: input.userId ?? null,
        type: input.type,
        to: input.to,
        subject: input.subject,
        status: 'FAILED',
        errorMessage,
        contextJson: (input.context ?? {}) as Prisma.InputJsonValue,
      },
    });
  }
}
