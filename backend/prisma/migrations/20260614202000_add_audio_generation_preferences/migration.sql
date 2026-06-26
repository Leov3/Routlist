-- CreateTable
CREATE TABLE "UserAudioGenerationPreference" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "composerText" TEXT NOT NULL DEFAULT '',
    "composerVoiceId" TEXT NOT NULL DEFAULT '',
    "composerModelId" TEXT NOT NULL DEFAULT '',
    "composerOutputFormat" TEXT NOT NULL DEFAULT 'mp3_44100_128',
    "composerStability" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "composerSimilarityBoost" DOUBLE PRECISION NOT NULL DEFAULT 0.75,
    "composerStyle" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "composerSpeed" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "composerSpeakerBoost" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAudioGenerationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserAudioGenerationPreference_organizationId_userId_key" ON "UserAudioGenerationPreference"("organizationId", "userId");
CREATE INDEX "UserAudioGenerationPreference_organizationId_userId_idx" ON "UserAudioGenerationPreference"("organizationId", "userId");

-- AddForeignKey
ALTER TABLE "UserAudioGenerationPreference" ADD CONSTRAINT "UserAudioGenerationPreference_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserAudioGenerationPreference" ADD CONSTRAINT "UserAudioGenerationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
