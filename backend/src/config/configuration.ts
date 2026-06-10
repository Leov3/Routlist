export default () => ({
  port: parseInt(process.env.PORT ?? '4000', 10),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  auth: {
    jwtSecret: process.env.JWT_SECRET ?? 'change-me',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
    cookieName: process.env.COOKIE_NAME ?? 'routlis_token',
    cookieSecure: process.env.COOKIE_SECURE === 'true',
  },
  storage: {
    driver: process.env.STORAGE_DRIVER ?? 'local',
    localStoragePath:
      process.env.LOCAL_STORAGE_PATH ?? '/var/www/routlis/storage',
    localAudioPath:
      process.env.LOCAL_AUDIO_PATH ?? '/var/www/routlis/storage/audio-assets',
    publicAudioBaseUrl:
      process.env.PUBLIC_AUDIO_BASE_URL ??
      'http://localhost:4000/files/audio-assets',
  },
});
