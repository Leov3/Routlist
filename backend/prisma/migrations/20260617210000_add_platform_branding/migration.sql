-- CreateTable
CREATE TABLE IF NOT EXISTS "PlatformBrandingSetting" (
    "id" TEXT NOT NULL,
    "platformName" TEXT NOT NULL DEFAULT 'Routlis',
    "tagline" TEXT,
    "logoFileName" TEXT,
    "logoMimeType" TEXT,
    "logoStorageKey" TEXT,
    "faviconFileName" TEXT,
    "faviconMimeType" TEXT,
    "faviconStorageKey" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformBrandingSetting_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'PlatformBrandingSetting_updatedById_fkey'
      AND table_name = 'PlatformBrandingSetting'
  ) THEN
    ALTER TABLE "PlatformBrandingSetting"
    ADD CONSTRAINT "PlatformBrandingSetting_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
