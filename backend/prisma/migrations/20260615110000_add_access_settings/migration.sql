-- CreateTable
CREATE TABLE IF NOT EXISTS "AccessSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "roleDefaults" JSONB NOT NULL,
    "organizationOverrides" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessSettings_pkey" PRIMARY KEY ("id")
);
