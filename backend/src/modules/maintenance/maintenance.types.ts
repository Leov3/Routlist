export type MaintenanceMigrationItem = {
  name: string;
  finishedAt: string | null;
  rolledBackAt: string | null;
  startedAt: string | null;
  appliedStepsCount: number | null;
};

export type MaintenanceMigrationStatus = {
  currentVersion: string | null;
  appliedCount: number;
  pendingCount: number;
  applied: MaintenanceMigrationItem[];
  pending: string[];
  lastAppliedAt: string | null;
};

export type MaintenanceBackupSettings = {
  id: string;
  isEnabled: boolean;
  includeDatabase: boolean;
  includeStorage: boolean;
  scheduleMode: 'MANUAL' | 'EVERY_HOURS';
  everyHours: number;
  retentionDays: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MaintenanceBackupListItem = {
  id: string;
  label: string | null;
  source: string;
  status: string;
  includeDatabase: boolean;
  includeStorage: boolean;
  archiveFileName: string;
  databaseDumpFileName: string | null;
  storageArchiveFileName: string | null;
  sizeBytes: number;
  expiresAt: string | null;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string | null;
    fullName: string | null;
    email: string | null;
  } | null;
  downloadUrl: string;
  databaseDownloadUrl: string | null;
  storageDownloadUrl: string | null;
};

export type MaintenanceAuditItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
  user: {
    id: string | null;
    fullName: string | null;
    email: string | null;
  } | null;
};

export type MaintenanceStatusResponse = {
  migration: MaintenanceMigrationStatus;
  settings: MaintenanceBackupSettings;
  backups: MaintenanceBackupListItem[];
  audit: MaintenanceAuditItem[];
  storage: {
    backupRootPath: string;
    backupBytes: number;
  };
};
