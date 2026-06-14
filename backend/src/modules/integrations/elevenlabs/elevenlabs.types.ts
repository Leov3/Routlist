export type ElevenLabsConnectionStatus =
  | 'NOT_CONFIGURED'
  | 'PENDING'
  | 'CONNECTED'
  | 'ERROR'
  | 'INACTIVE';

export type ElevenLabsConnectionStatusResponse =
  | 'not_configured'
  | 'pending'
  | 'connected'
  | 'error'
  | 'inactive';

export type ElevenLabsVoiceSummary = {
  voiceId: string;
  name: string;
  category?: string | null;
  labels?: Record<string, string> | null;
  previewUrl?: string | null;
};

export type ElevenLabsSettingsResponse = {
  isActive: boolean;
  connectionStatus: ElevenLabsConnectionStatusResponse;
  apiKeyConfigured: boolean;
  apiKeyMasked: string | null;
  baseUrl: string;
  defaultVoiceId: string | null;
  defaultModelId: string;
  defaultOutputFormat: string;
  stability: number;
  similarityBoost: number;
  style: number;
  speed: number;
  speakerBoost: boolean;
  lastTestAt: string | null;
  lastTestMessage: string | null;
};

export type ElevenLabsVoiceListResponse = {
  voices: ElevenLabsVoiceSummary[];
  nextPageToken: string | null;
  totalCount: number | null;
};

export type ElevenLabsGenerateAudioResponse = {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  audioBase64: string;
};
