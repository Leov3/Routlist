ALTER TABLE "AccessSettings"
ADD COLUMN IF NOT EXISTS "organizationRoleDefaults" JSONB NOT NULL DEFAULT '{}'::jsonb;

