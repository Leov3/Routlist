-- CreateTable
CREATE TABLE "ElevenLabsIntegrationSetting" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "apiKeyEncrypted" TEXT,
    "apiKeyIv" TEXT,
    "apiKeyAuthTag" TEXT,
    "apiKeyLast4" TEXT,
    "baseUrl" TEXT NOT NULL DEFAULT 'https://api.elevenlabs.io',
    "defaultVoiceId" TEXT,
    "defaultModelId" TEXT NOT NULL DEFAULT 'eleven_multilingual_v2',
    "defaultOutputFormat" TEXT NOT NULL DEFAULT 'mp3_44100_128',
    "stability" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "similarityBoost" DOUBLE PRECISION NOT NULL DEFAULT 0.75,
    "style" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "speed" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "speakerBoost" BOOLEAN NOT NULL DEFAULT true,
    "connectionStatus" TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
    "lastTestAt" TIMESTAMP(3),
    "lastTestMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElevenLabsIntegrationSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ElevenLabsIntegrationSetting_organizationId_key" ON "ElevenLabsIntegrationSetting"("organizationId");

-- CreateIndex
CREATE INDEX "ElevenLabsIntegrationSetting_organizationId_idx" ON "ElevenLabsIntegrationSetting"("organizationId");

-- AddForeignKey
ALTER TABLE "ElevenLabsIntegrationSetting" ADD CONSTRAINT "ElevenLabsIntegrationSetting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed permission for integration management
INSERT INTO "Permission" ("id", "key", "description", "createdAt")
VALUES
  ('11111111-1111-1111-1111-111111111110', 'integration:manage', 'Manage external integrations', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT
  CASE
    WHEN r."name" = 'OWNER' THEN '11111111-1111-1111-1111-111111111111'
    ELSE '11111111-1111-1111-1111-111111111112'
  END,
  r."id",
  p."id"
FROM "Role" r
JOIN "Permission" p ON p."key" = 'integration:manage'
WHERE r."name" IN ('OWNER', 'ADMIN')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
