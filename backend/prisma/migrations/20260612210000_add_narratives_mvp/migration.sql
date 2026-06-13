-- CreateEnum
CREATE TYPE "NarrativeStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "NarrativeVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "NarrativeRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NarrativeRunEventType" AS ENUM ('NODE_STARTED', 'NODE_COMPLETED', 'NODE_SKIPPED', 'AUDIO_PLAYED', 'DECISION_SELECTED', 'RUN_COMPLETED', 'RUN_CANCELLED');

-- CreateTable
CREATE TABLE "Narrative" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "NarrativeStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT,
    "publishedVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Narrative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NarrativeVersion" (
    "id" TEXT NOT NULL,
    "narrativeId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "NarrativeVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "graphJson" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "publishedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NarrativeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NarrativeRun" (
    "id" TEXT NOT NULL,
    "narrativeId" TEXT NOT NULL,
    "narrativeVersionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "startedByUserId" TEXT NOT NULL,
    "status" "NarrativeRunStatus" NOT NULL DEFAULT 'RUNNING',
    "currentNodeId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "NarrativeRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NarrativeRunEvent" (
    "id" TEXT NOT NULL,
    "narrativeRunId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "eventType" "NarrativeRunEventType" NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NarrativeRunEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Narrative_publishedVersionId_key" ON "Narrative"("publishedVersionId");

-- CreateIndex
CREATE INDEX "Narrative_organizationId_status_idx" ON "Narrative"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Narrative_organizationId_createdAt_idx" ON "Narrative"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "NarrativeVersion_narrativeId_status_idx" ON "NarrativeVersion"("narrativeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "NarrativeVersion_narrativeId_versionNumber_key" ON "NarrativeVersion"("narrativeId", "versionNumber");

-- CreateIndex
CREATE INDEX "NarrativeRun_organizationId_startedAt_idx" ON "NarrativeRun"("organizationId", "startedAt");

-- CreateIndex
CREATE INDEX "NarrativeRun_startedByUserId_startedAt_idx" ON "NarrativeRun"("startedByUserId", "startedAt");

-- CreateIndex
CREATE INDEX "NarrativeRunEvent_narrativeRunId_createdAt_idx" ON "NarrativeRunEvent"("narrativeRunId", "createdAt");

-- CreateIndex
CREATE INDEX "NarrativeRunEvent_nodeId_createdAt_idx" ON "NarrativeRunEvent"("nodeId", "createdAt");

-- AddForeignKey
ALTER TABLE "Narrative" ADD CONSTRAINT "Narrative_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Narrative" ADD CONSTRAINT "Narrative_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Narrative" ADD CONSTRAINT "Narrative_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Narrative" ADD CONSTRAINT "Narrative_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "NarrativeVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NarrativeVersion" ADD CONSTRAINT "NarrativeVersion_narrativeId_fkey" FOREIGN KEY ("narrativeId") REFERENCES "Narrative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NarrativeVersion" ADD CONSTRAINT "NarrativeVersion_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NarrativeRun" ADD CONSTRAINT "NarrativeRun_narrativeId_fkey" FOREIGN KEY ("narrativeId") REFERENCES "Narrative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NarrativeRun" ADD CONSTRAINT "NarrativeRun_narrativeVersionId_fkey" FOREIGN KEY ("narrativeVersionId") REFERENCES "NarrativeVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NarrativeRun" ADD CONSTRAINT "NarrativeRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NarrativeRun" ADD CONSTRAINT "NarrativeRun_startedByUserId_fkey" FOREIGN KEY ("startedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NarrativeRunEvent" ADD CONSTRAINT "NarrativeRunEvent_narrativeRunId_fkey" FOREIGN KEY ("narrativeRunId") REFERENCES "NarrativeRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
