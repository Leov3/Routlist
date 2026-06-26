CREATE TABLE IF NOT EXISTS "UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "sessionId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceLabel" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

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

ALTER TABLE "UserSession"
ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "UserSession_sessionId_key" ON "UserSession"("sessionId");
CREATE INDEX IF NOT EXISTS "UserSession_sessionId_idx" ON "UserSession"("sessionId");
CREATE INDEX IF NOT EXISTS "UserSession_userId_isActive_idx" ON "UserSession"("userId", "isActive");

ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
