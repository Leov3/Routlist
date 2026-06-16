function normalizeOrigin(value: string) {
  return value.trim().replace(/\/+$/, '');
}

function splitOrigins(value: string | undefined) {
  if (!value) return [];
  if (value.trim() === '*') return ['*'];

  return value
    .split(',')
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean);
}

export default () => {
  const frontendUrl = normalizeOrigin(
    process.env.FRONTEND_URL ?? 'http://localhost:3001',
  );
  const defaultCorsOrigins = [
    frontendUrl,
    'http://localhost:3001',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
  ];
  const corsOrigins = Array.from(
    new Set([
      ...defaultCorsOrigins,
      ...splitOrigins(process.env.CORS_ORIGINS),
      ...splitOrigins(process.env.ALLOWED_ORIGINS),
    ]),
  );

  return {
    port: parseInt(process.env.PORT ?? '4000', 10),
    frontendUrl,
    cors: {
      origins: corsOrigins.includes('*') ? ['*'] : corsOrigins,
    },
    auth: {
      jwtSecret: process.env.JWT_SECRET ?? 'change-me',
      jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
      cookieName: process.env.COOKIE_NAME ?? 'routlis_token',
      cookieSecure: process.env.COOKIE_SECURE === 'true',
    },
    integration: {
      encryptionKey:
        process.env.INTEGRATION_ENCRYPTION_KEY ??
        process.env.JWT_SECRET ??
        'change-me',
    },
    mail: {
      enabled: process.env.MAIL_ENABLED === 'true',
      fromName: process.env.MAIL_FROM_NAME ?? 'Routlis',
      fromEmail: process.env.MAIL_FROM_EMAIL ?? 'notificaciones@routlis.com',
      replyTo: process.env.MAIL_REPLY_TO ?? undefined,
      smtpHost: process.env.MAIL_SMTP_HOST ?? undefined,
      smtpPort: process.env.MAIL_SMTP_PORT
        ? parseInt(process.env.MAIL_SMTP_PORT, 10)
        : undefined,
      smtpSecure: process.env.MAIL_SMTP_SECURE === 'true',
      smtpUser: process.env.MAIL_SMTP_USER ?? undefined,
      smtpPassword: process.env.MAIL_SMTP_PASSWORD ?? undefined,
    },
    storage: {
      driver: process.env.STORAGE_DRIVER ?? 'local',
      localStoragePath:
        process.env.LOCAL_STORAGE_PATH ?? '/var/www/routlis/storage',
      localAudioPath:
        process.env.LOCAL_AUDIO_PATH ?? '/var/www/routlis/storage/audio-assets',
      localBackupPath:
        process.env.LOCAL_BACKUP_PATH ??
        '/var/www/routlis/storage/backups',
      publicAudioBaseUrl:
        process.env.PUBLIC_AUDIO_BASE_URL ??
        'http://localhost:4000/files/audio-assets',
    },
  };
};
