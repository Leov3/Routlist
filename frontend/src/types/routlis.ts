export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  organizationId: string;
  role: string;
  permissions: string[];
};

export type Organization = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    members: number;
    audioAssets: number;
    audioCategories: number;
    audioButtons: number;
  };
};

export type AudioAsset = {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds?: number | null;
  transcript?: string | null;
  sourceType?: "UPLOAD" | "TTS" | string;
  lifecycleStatus?: "TEMPORARY" | "PERSISTED" | string;
  expiresAt?: string | null;
  generatedText?: string | null;
  generatedVoiceId?: string | null;
  generatedVoiceName?: string | null;
  generatedModelId?: string | null;
  generatedOutputFormat?: string | null;
  generatedSettingsJson?: Record<string, unknown> | null;
  generationJobId?: string | null;
  autoCreatedButtonId?: string | null;
  isActive: boolean;
  createdAt: string;
  audioUrl?: string;
  audioDownloadUrl?: string;
};

export type AudioCategory = {
  id: string;
  name: string;
  description?: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type BoardAudioButton = {
  id: string;
  label: string;
  description?: string | null;
  color?: string | null;
  shortcutKey?: string | null;
  sortOrder: number;
  isFavorite?: boolean;
  category: {
    id: string;
    name: string;
  };
  audioUrl: string;
  audioAsset: {
    id: string;
    originalName: string;
    durationSeconds?: number | null;
    mimeType: string;
    transcript?: string | null;
    createdAt: string;
    audioUrl?: string;
    audioDownloadUrl?: string;
  };
  imageUrl?: string | null;
  imageDownloadUrl?: string | null;
};

export type BoardViewMode = "simple" | "dual";
export type BoardDensity = "compact" | "medium" | "large";

export type BoardPreferences = {
  viewMode: BoardViewMode;
  density: BoardDensity;
  volume: number;
};

export type BoardCategory = {
  id: string;
  name: string;
  description?: string | null;
  sortOrder: number;
  buttons: BoardAudioButton[];
};

export type AudioButton = {
  id: string;
  label: string;
  description?: string | null;
  color?: string | null;
  shortcutKey?: string | null;
  sortOrder: number;
  isActive: boolean;
  category: AudioCategory;
  audioAsset: AudioAsset;
  imageFileName?: string | null;
  imageMimeType?: string | null;
  imageSizeBytes?: number | null;
  imageStorageKey?: string | null;
  imagePublicUrl?: string | null;
  imageUrl?: string | null;
  imageDownloadUrl?: string | null;
};

export type PlaybackEvent = {
  id: string;
  startedAt: string;
  stoppedAt?: string | null;
  durationPlayedSeconds?: number | null;
  playbackMode: string;
  user: { id: string; fullName: string; email: string };
  audioAsset: { id: string; originalName: string; fileName: string };
  audioButton: {
    id: string;
    label: string;
    category: { id: string; name: string };
  };
};

export type RecentPlaybackEvent = PlaybackEvent;

export type AudioGenerationJobStatus =
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELED"
  | "EXPIRED";

export type AudioGenerationJob = {
  id: string;
  status: AudioGenerationJobStatus | string;
  provider: string;
  inputText: string;
  normalizedText: string;
  voiceId: string;
  voiceName?: string | null;
  modelId: string;
  outputFormat: string;
  stability: number;
  similarityBoost: number;
  style: number;
  speed: number;
  speakerBoost: boolean;
  requestHash: string;
  audioAssetId?: string | null;
  audioButtonId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  attemptCount: number;
  lastAttemptAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  asset?: AudioGenerationLibraryItem | null;
};

export type AudioGenerationLibraryItem = AudioAsset & {
  createdBy: {
    id: string;
    fullName: string;
    email: string;
  };
};

export type AudioGenerationPreferences = {
  composerText: string;
  composerVoiceId: string;
  composerModelId: string;
  composerOutputFormat: string;
  composerStability: number;
  composerSimilarityBoost: number;
  composerStyle: number;
  composerSpeed: number;
  composerSpeakerBoost: boolean;
};
