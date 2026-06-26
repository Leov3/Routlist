-- AlterTable
ALTER TABLE "AudioAsset" ADD COLUMN     "autoCreatedButtonId" TEXT;
ALTER TABLE "AudioAsset" ADD COLUMN     "expiresAt" TIMESTAMP(3);
ALTER TABLE "AudioAsset" ADD COLUMN     "generatedModelId" TEXT;
ALTER TABLE "AudioAsset" ADD COLUMN     "generatedOutputFormat" TEXT;
ALTER TABLE "AudioAsset" ADD COLUMN     "generatedSettingsJson" JSONB;
ALTER TABLE "AudioAsset" ADD COLUMN     "generatedText" TEXT;
ALTER TABLE "AudioAsset" ADD COLUMN     "generatedVoiceId" TEXT;
ALTER TABLE "AudioAsset" ADD COLUMN     "generatedVoiceName" TEXT;
ALTER TABLE "AudioAsset" ADD COLUMN     "generationJobId" TEXT;
ALTER TABLE "AudioAsset" ADD COLUMN     "lifecycleStatus" TEXT NOT NULL DEFAULT 'PERSISTED';
ALTER TABLE "AudioAsset" ADD COLUMN     "sourceType" TEXT NOT NULL DEFAULT 'UPLOAD';

-- CreateTable
CREATE TABLE "AudioGenerationJob" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'elevenlabs',
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "inputText" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "voiceId" TEXT NOT NULL,
    "voiceName" TEXT,
    "modelId" TEXT NOT NULL,
    "outputFormat" TEXT NOT NULL,
    "stability" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "similarityBoost" DOUBLE PRECISION NOT NULL DEFAULT 0.75,
    "style" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "speed" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "speakerBoost" BOOLEAN NOT NULL DEFAULT true,
    "requestHash" TEXT NOT NULL,
    "audioAssetId" TEXT,
    "audioButtonId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AudioGenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AudioGenerationJob_audioAssetId_key" ON "AudioGenerationJob"("audioAssetId");
CREATE UNIQUE INDEX "AudioGenerationJob_audioButtonId_key" ON "AudioGenerationJob"("audioButtonId");
CREATE INDEX "AudioGenerationJob_organizationId_status_createdAt_idx" ON "AudioGenerationJob"("organizationId", "status", "createdAt");
CREATE INDEX "AudioGenerationJob_organizationId_requestHash_idx" ON "AudioGenerationJob"("organizationId", "requestHash");
CREATE INDEX "AudioGenerationJob_organizationId_createdById_createdAt_idx" ON "AudioGenerationJob"("organizationId", "createdById", "createdAt");
CREATE UNIQUE INDEX "AudioAsset_generationJobId_key" ON "AudioAsset"("generationJobId");
CREATE INDEX "AudioAsset_organizationId_sourceType_createdAt_idx" ON "AudioAsset"("organizationId", "sourceType", "createdAt");
CREATE INDEX "AudioAsset_organizationId_lifecycleStatus_expiresAt_idx" ON "AudioAsset"("organizationId", "lifecycleStatus", "expiresAt");

-- AddForeignKey
ALTER TABLE "AudioGenerationJob" ADD CONSTRAINT "AudioGenerationJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AudioGenerationJob" ADD CONSTRAINT "AudioGenerationJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AudioGenerationJob" ADD CONSTRAINT "AudioGenerationJob_audioAssetId_fkey" FOREIGN KEY ("audioAssetId") REFERENCES "AudioAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AudioGenerationJob" ADD CONSTRAINT "AudioGenerationJob_audioButtonId_fkey" FOREIGN KEY ("audioButtonId") REFERENCES "AudioButton"("id") ON DELETE SET NULL ON UPDATE CASCADE;
