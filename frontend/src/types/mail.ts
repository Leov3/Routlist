export type MailSettings = {
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
  lastTestAt: string | null;
  lastTestMessage: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MailLog = {
  id: string;
  type: string;
  to: string;
  subject: string;
  status: string;
  providerMessageId?: string | null;
  errorMessage: string | null;
  contextJson?: {
    acceptedRecipients?: string[];
    rejectedRecipients?: string[];
    responseMessage?: string | null;
    [key: string]: unknown;
  } | null;
  createdAt: string;
};
