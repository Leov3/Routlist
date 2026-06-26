export type MailTemplateType =
  | 'PASSWORD_RESET'
  | 'PASSWORD_CHANGED'
  | 'INVITE'
  | 'APPROVAL'
  | 'WELCOME'
  | 'TEST';

export type MailTemplateRecord = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  subject: string;
  htmlBody: string;
  textBody: string | null;
  isActive: boolean;
  updatedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type MailEventRecord = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isEnabled: boolean;
  templateKey: string | null;
  channels: unknown;
  updatedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type MailQueueRecord = {
  id: string;
  organizationId: string | null;
  userId: string | null;
  eventKey: string | null;
  templateKey: string | null;
  to: string;
  subject: string;
  status: string;
  attempts: number;
  lastError: string | null;
  scheduledAt: Date | null;
  processedAt: Date | null;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type MailSendResult = {
  ok: boolean;
  messageId?: string;
  acceptedRecipients?: string[];
  rejectedRecipients?: string[];
  responseMessage?: string | null;
  skipped?: boolean;
  error?: string;
};

export type ResolvedMailSettings = {
  provider: 'smtp';
  enabled: boolean;
  fromName: string;
  fromEmail: string;
  replyTo?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpSecure?: boolean | null;
  smtpUser?: string | null;
  smtpPassword?: string | null;
};

export type MailRenderContext = Record<string, string | number | boolean | null | undefined>;
