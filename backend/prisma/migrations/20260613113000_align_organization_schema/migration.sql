ALTER TABLE "Organization"
ADD COLUMN IF NOT EXISTS "slug" TEXT,
ADD COLUMN IF NOT EXISTS "isPlatformInternal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "maxUsers" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN IF NOT EXISTS "maxStorageBytes" BIGINT NOT NULL DEFAULT 1073741824;

UPDATE "Organization"
SET "slug" = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(TRIM("name"), '[^a-zA-Z0-9]+', '-', 'g'),
    '(^-+|-+$)',
    '',
    'g'
  )
)
WHERE "slug" IS NULL;

UPDATE "Organization"
SET "slug" = CONCAT("slug", '-', SUBSTRING("id" FROM 1 FOR 8))
WHERE EXISTS (
  SELECT 1
  FROM "Organization" dup
  WHERE dup."slug" = "Organization"."slug"
    AND dup."id" <> "Organization"."id"
);

ALTER TABLE "Organization"
ALTER COLUMN "slug" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'Organization_slug_key'
  ) THEN
    CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
  END IF;
END $$;
