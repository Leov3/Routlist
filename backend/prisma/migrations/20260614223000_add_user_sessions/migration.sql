ALTER TABLE "UserSession"
ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN IF NOT EXISTS "sessionId" TEXT,
ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "deviceLabel" TEXT,
ADD COLUMN IF NOT EXISTS "revokedReason" TEXT,
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "UserSession"
SET
  "sessionId" = COALESCE(
    "sessionId",
    md5(random()::text || "id"::text || clock_timestamp()::text)
  ),
  "isActive" = CASE
    WHEN "status" = 'ACTIVE' THEN true
    ELSE false
  END;

ALTER TABLE "UserSession"
ALTER COLUMN "sessionId" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "UserSession_sessionId_key" ON "UserSession"("sessionId");
CREATE INDEX IF NOT EXISTS "UserSession_sessionId_idx" ON "UserSession"("sessionId");
CREATE INDEX IF NOT EXISTS "UserSession_userId_isActive_idx" ON "UserSession"("userId", "isActive");
