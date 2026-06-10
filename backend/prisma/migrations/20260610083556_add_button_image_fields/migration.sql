-- AlterTable
ALTER TABLE "AudioButton" ADD COLUMN     "imageFileName" TEXT,
ADD COLUMN     "imageMimeType" TEXT,
ADD COLUMN     "imagePublicUrl" TEXT,
ADD COLUMN     "imageSizeBytes" INTEGER,
ADD COLUMN     "imageStorageKey" TEXT;
