import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { ResolvedMailSettings } from '../mail.types';

type SendMailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string | null;
};

@Injectable()
export class SmtpMailProvider {
  private readonly logger = new Logger(SmtpMailProvider.name);

  async sendMail(
    settings: ResolvedMailSettings,
    input: SendMailInput,
  ): Promise<{
    messageId?: string;
    acceptedRecipients?: string[];
    rejectedRecipients?: string[];
    responseMessage?: string | null;
  }> {
    if (!settings.enabled) {
      this.logger.warn(`Mail disabled, skipping send to ${input.to}`);
      return {};
    }

    const transporter = this.createTransport(settings);
    const result = await transporter.sendMail({
      from: `"${settings.fromName}" <${settings.fromEmail}>`,
      to: input.to,
      replyTo: input.replyTo ?? settings.replyTo ?? undefined,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });

    return {
      messageId: result.messageId,
      acceptedRecipients: Array.isArray(result.accepted) ? result.accepted.map(String) : [],
      rejectedRecipients: Array.isArray(result.rejected) ? result.rejected.map(String) : [],
      responseMessage: typeof result.response === 'string' ? result.response : null,
    };
  }

  private createTransport(settings: ResolvedMailSettings): Transporter {
    return nodemailer.createTransport({
      host: settings.smtpHost ?? undefined,
      port: settings.smtpPort ?? undefined,
      secure: Boolean(settings.smtpSecure),
      auth: settings.smtpUser && settings.smtpPassword
        ? {
            user: settings.smtpUser,
            pass: settings.smtpPassword,
          }
        : undefined,
    });
  }
}
