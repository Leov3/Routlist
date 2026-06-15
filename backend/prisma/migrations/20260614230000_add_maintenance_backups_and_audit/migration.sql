-- CreateTable
CREATE TABLE "MaintenanceBackupSetting" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "includeDatabase" BOOLEAN NOT NULL DEFAULT true,
    "includeStorage" BOOLEAN NOT NULL DEFAULT true,
    "scheduleMode" TEXT NOT NULL DEFAULT 'MANUAL',
    "everyHours" INTEGER NOT NULL DEFAULT 24,
    "retentionDays" INTEGER NOT NULL DEFAULT 7,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceBackupSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceBackup" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "label" TEXT,
    "includeDatabase" BOOLEAN NOT NULL DEFAULT true,
    "includeStorage" BOOLEAN NOT NULL DEFAULT true,
    "backupDirectoryKey" TEXT NOT NULL,
    "archiveFileName" TEXT NOT NULL,
    "databaseDumpFileName" TEXT,
    "storageArchiveFileName" TEXT,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceBackup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemAuditEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceBackupSetting_organizationId_key" ON "MaintenanceBackupSetting"("organizationId");

-- CreateIndex
CREATE INDEX "MaintenanceBackup_organizationId_createdAt_idx" ON "MaintenanceBackup"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "MaintenanceBackup_organizationId_status_createdAt_idx" ON "MaintenanceBackup"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SystemAuditEvent_organizationId_createdAt_idx" ON "SystemAuditEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "SystemAuditEvent_organizationId_action_createdAt_idx" ON "SystemAuditEvent"("organizationId", "action", "createdAt");

-- AddForeignKey
ALTER TABLE "MaintenanceBackupSetting" ADD CONSTRAINT "MaintenanceBackupSetting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceBackup" ADD CONSTRAINT "MaintenanceBackup_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceBackup" ADD CONSTRAINT "MaintenanceBackup_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemAuditEvent" ADD CONSTRAINT "SystemAuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemAuditEvent" ADD CONSTRAINT "SystemAuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
