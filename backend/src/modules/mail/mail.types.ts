export type MailTemplateType =
  | 'PASSWORD_RESET'
  | 'PASSWORD_CHANGED'
  | 'INVITE'
  | 'APPROVAL'
  | 'WELCOME'
  | 'TEST';

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
