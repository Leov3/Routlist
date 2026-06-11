export type StoredFile = {
  storageDriver: 'local';
  storageKey: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  absolutePath: string;
};

export type StoredImage = StoredFile;

export const ALLOWED_AUDIO_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
] as const;

export const MAX_AUDIO_SIZE_BYTES = 20 * 1024 * 1024;

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
