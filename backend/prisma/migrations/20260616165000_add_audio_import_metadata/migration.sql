-- Add metadata captured from CSV imports to audio assets.
ALTER TABLE "AudioAsset"
ADD COLUMN IF NOT EXISTS "importMetadata" JSONB;
