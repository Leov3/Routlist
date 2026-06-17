"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  AlertTriangle,
  Database,
  Download,
  FileUp,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  TimerReset,
  Upload,
  Trash2,
} from "lucide-react";
import { AdminProtectedPage } from "@/components/layout/AdminProtectedPage";
import { DataState } from "@/components/ui/DataState";
import { FilterBar } from "@/components/ui/FilterBar";
import { PageHeader } from "@/components/ui/PageHeader";
import { api, apiUrl, formatBytes } from "@/lib/api";
import type {
  MaintenanceBackupItem,
  MaintenanceBackupSettings,
  MaintenanceStatus,
} from "@/types/routlis";

type BackupScope = "db" | "storage" | "both";
type SettingsForm = {
  isEnabled: boolean;
  includeDatabase: boolean;
  includeStorage: boolean;
  scheduleMode: "MANUAL" | "EVERY_HOURS";
  everyHours: string;
  retentionDays: string;
};

type RestoreUploadState = {
  confirmRestore: boolean;
  databaseDump: File | null;
  storageArchive: File | null;
};

const DEFAULT_FORM: SettingsForm = {
  isEnabled: false,
  includeDatabase: true,
  includeStorage: true,
  scheduleMode: "MANUAL",
  everyHours: "24",
  retentionDays: "7",
};

function scopeFromBackup(backup: MaintenanceBackupItem) {
  if (backup.includeDatabase && backup.includeStorage) return "both";
  if (backup.includeDatabase) return "db";
  return "storage";
}

function scopeLabel(scope: BackupScope) {
  if (scope === "both") return "DB + Storage";
  if (scope === "db") return "Solo DB";
  return "Solo storage";
}

export default function MaintenancePage() {
  const [status, setStatus] = useState<MaintenanceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadingRestore, setUploadingRestore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [manualLabel, setManualLabel] = useState("");
  const [manualScope, setManualScope] = useState<BackupScope>("both");
  const [form, setForm] = useState<SettingsForm>(DEFAULT_FORM);
  const [restoreUpload, setRestoreUpload] = useState<RestoreUploadState>({
    confirmRestore: false,
    databaseDump: null,
    storageArchive: null,
  });

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    setError(null);

    try {
      const result = await api<MaintenanceStatus>("/maintenance/status");
      setStatus(result);
      setForm({
        isEnabled: result.settings.isEnabled,
        includeDatabase: result.settings.includeDatabase,
        includeStorage: result.settings.includeStorage,
        scheduleMode: result.settings.scheduleMode,
        everyHours: String(result.settings.everyHours),
        retentionDays: String(result.settings.retentionDays),
      });
      if (!manualLabel) {
        setManualLabel(`Respaldo ${new Date().toLocaleString()}`);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo cargar el módulo de mantenimiento.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [manualLabel]);

  useEffect(() => {
    void load();
  }, [load]);

  const migration = status?.migration;
  const backups = useMemo(() => status?.backups ?? [], [status?.backups]);
  const audit = status?.audit ?? [];

  const backupTotals = useMemo(
    () => ({
      total: backups.length,
      db: backups.filter((backup) => backup.includeDatabase).length,
      storage: backups.filter((backup) => backup.includeStorage).length,
      failed: backups.filter((backup) => backup.status === "FAILED").length,
    }),
    [backups],
  );

  async function saveSettings() {
    setSaving(true);
    setError(null);
    try {
      await api<MaintenanceBackupSettings>("/maintenance/settings", {
        method: "PATCH",
        body: JSON.stringify({
          isEnabled: form.isEnabled,
          includeDatabase: form.includeDatabase,
          includeStorage: form.includeStorage,
          scheduleMode: form.scheduleMode,
          everyHours: Number(form.everyHours),
          retentionDays: Number(form.retentionDays),
        }),
      });
      setFeedback("Configuración guardada.");
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo guardar la configuración.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function createBackup() {
    setCreating(true);
    setError(null);
    try {
      await api("/maintenance/backups", {
        method: "POST",
        body: JSON.stringify({
          label: manualLabel.trim() || undefined,
          includeDatabase: manualScope === "both" || manualScope === "db",
          includeStorage: manualScope === "both" || manualScope === "storage",
        }),
      });
      setFeedback("Backup creado correctamente.");
      await load(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo crear el backup.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function restoreBackup(id: string) {
    const backup = backups.find((item) => item.id === id);
    if (!backup) return;

    const confirmed = window.confirm(
      `Restaurar "${backup.label ?? backup.archiveFileName}" reemplazará datos y storage. ¿Continuar?`,
    );
    if (!confirmed) return;

    setRestoringId(id);
    setError(null);
    try {
      await api(`/maintenance/backups/${id}/restore`, { method: "POST" });
      setFeedback("Restauración completada.");
      await load(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo restaurar el backup.",
      );
    } finally {
      setRestoringId(null);
    }
  }

  async function restoreFromFiles() {
    if (!restoreUpload.confirmRestore) {
      setError("Debes confirmar la restauración antes de continuar.");
      return;
    }

    if (!restoreUpload.databaseDump || !restoreUpload.storageArchive) {
      setError("Debes subir el dump de base de datos y el archive de storage.");
      return;
    }

    setUploadingRestore(true);
    setError(null);
    try {
      const payload = new FormData();
      payload.append("confirmRestore", "true");
      payload.append("databaseDump", restoreUpload.databaseDump);
      payload.append("storageArchive", restoreUpload.storageArchive);

      await api("/maintenance/backups/import-restore", {
        method: "POST",
        body: payload,
        formData: true,
      });

      setFeedback("Restauración desde archivos completada.");
      setRestoreUpload({
        confirmRestore: false,
        databaseDump: null,
        storageArchive: null,
      });
      await load(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo restaurar desde los archivos.",
      );
    } finally {
      setUploadingRestore(false);
    }
  }

  async function deleteBackup(id: string) {
    const backup = backups.find((item) => item.id === id);
    if (!backup) return;

    const confirmed = window.confirm(
      `Eliminar "${backup.label ?? backup.archiveFileName}" borrará el archivo y su registro.`,
    );
    if (!confirmed) return;

    setDeletingId(id);
    setError(null);
    try {
      await api(`/maintenance/backups/${id}`, { method: "DELETE" });
      setFeedback("Backup eliminado.");
      await load(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo eliminar el backup.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AdminProtectedPage>
      {loading ? (
        <DataState>Cargando mantenimiento...</DataState>
      ) : (
        <>
          <PageHeader
            title="Migraciones y backup"
            description="Control de migraciones Prisma, backups por alcance y restauración administrada."
            action={
              <button
                type="button"
                onClick={() => void load(true)}
                className="inline-flex h-10 items-center gap-2 rounded-2xl border border-outline-variant bg-surface-container px-4 text-sm font-semibold text-on-surface transition-colors hover:border-primary"
              >
                <RefreshCw
                  className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                />
                Refrescar
              </button>
            }
          />

          {feedback && (
            <div className="success-surface mb-4 rounded-2xl px-4 py-3 text-sm">
              {feedback}
            </div>
          )}
          {error && (
            <div className="danger-surface mb-4 rounded-2xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Migraciones aplicadas"
              value={migration?.appliedCount ?? 0}
              icon={Database}
            />
            <SummaryCard
              label="Pendientes"
              value={migration?.pendingCount ?? 0}
              icon={AlertTriangle}
            />
            <SummaryCard
              label="Backups"
              value={backupTotals.total}
              icon={Archive}
            />
            <SummaryCard
              label="Errores"
              value={backupTotals.failed}
              icon={ShieldAlert}
            />
          </section>

          <section className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)]">
            <div className="space-y-5">
              <div className="rounded-[28px] border border-outline-variant bg-surface-container p-5 shadow-elevation-1">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight text-on-surface">
                      Estado de migraciones
                    </h2>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      Prisma y el esquema actual aplicado en la base de datos.
                    </p>
                  </div>
                  <span className="rounded-full border border-outline-variant bg-surface px-3 py-1 text-xs font-semibold text-on-surface-variant">
                    {migration?.currentVersion ?? "Sin migraciones"}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <InfoPill
                    label="Última aplicada"
                    value={migration?.lastAppliedAt ?? "N/D"}
                  />
                  <InfoPill
                    label="Pendientes"
                    value={String(migration?.pendingCount ?? 0)}
                  />
                  <InfoPill
                    label="Ruta backups"
                    value={status?.storage.backupRootPath ?? "N/D"}
                  />
                  <InfoPill
                    label="Espacio backups"
                    value={formatBytes(status?.storage.backupBytes ?? 0)}
                  />
                </div>

                <div className="mt-4 rounded-2xl border border-outline-variant bg-surface px-4 py-3 text-sm text-on-surface-variant">
                  Se conservan solo las 3 copias más recientes de base de datos
                  en el servidor. Los backups antiguos se eliminan
                  automáticamente.
                </div>

                <div className="mt-4 rounded-2xl border border-outline-variant bg-surface px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                    Pendientes
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {migration?.pending?.length ? (
                      migration.pending.map((item) => (
                        <span
                          key={item}
                          className="warning-surface-strong rounded-full px-3 py-1 text-xs"
                        >
                          {item}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-on-surface-variant">
                        No hay migraciones pendientes.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-outline-variant bg-surface-container p-5 shadow-elevation-1">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight text-on-surface">
                      Backup manual
                    </h2>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      Decide qué respaldar antes de crear el snapshot.
                    </p>
                  </div>
                  <span className="rounded-full border border-outline-variant bg-surface px-3 py-1 text-xs font-semibold text-on-surface-variant">
                    {scopeLabel(manualScope)}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                      Nombre
                    </span>
                    <input
                      value={manualLabel}
                      onChange={(event) => setManualLabel(event.target.value)}
                      className="h-11 w-full rounded-2xl border border-outline-variant bg-surface px-4 text-sm text-on-surface outline-none transition-colors focus:border-primary"
                      placeholder="Respaldo del día"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                      Alcance
                    </span>
                    <FilterBar
                      value={manualScope}
                      onChange={setManualScope}
                      options={[
                        { value: "both", label: "DB + Storage" },
                        { value: "db", label: "Solo DB" },
                        { value: "storage", label: "Solo storage" },
                      ]}
                    />
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={creating}
                    onClick={() => void createBackup()}
                    className="inline-flex h-11 items-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-on-primary transition-colors hover:opacity-90 disabled:opacity-50"
                  >
                    <Archive className="h-4 w-4" />
                    Crear backup
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setManualLabel(`Respaldo ${new Date().toLocaleString()}`)
                    }
                    className="inline-flex h-11 items-center gap-2 rounded-2xl border border-outline-variant bg-surface px-4 text-sm font-semibold text-on-surface transition-colors hover:border-primary"
                  >
                    <TimerReset className="h-4 w-4" />
                    Reponer nombre
                  </button>
                </div>
              </div>

              <div className="rounded-[28px] border border-outline-variant bg-surface-container p-5 shadow-elevation-1">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight text-on-surface">
                      Restaurar desde archivos
                    </h2>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      Sube un dump de PostgreSQL y el archive de storage para
                      reconstruir este entorno.
                    </p>
                  </div>
                  <span className="rounded-full border border-outline-variant bg-surface px-3 py-1 text-xs font-semibold text-on-surface-variant">
                    Inmediato
                  </span>
                </div>

                <div className="mt-4 grid gap-3">
                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                      Dump de base de datos
                    </span>
                    <div className="rounded-2xl border border-outline-variant bg-surface px-4 py-3">
                      <input
                        type="file"
                        accept=".dump,.backup,.sql,.tar,.gz,.zip,application/octet-stream"
                        onChange={(event) =>
                          setRestoreUpload((current) => ({
                            ...current,
                            databaseDump: event.target.files?.[0] ?? null,
                          }))
                        }
                        className="block w-full text-sm text-on-surface file:mr-4 file:rounded-xl file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-on-primary hover:file:opacity-90"
                      />
                      <p className="mt-2 text-xs text-on-surface-variant">
                        {restoreUpload.databaseDump
                          ? restoreUpload.databaseDump.name
                          : "Ningún archivo seleccionado"}
                      </p>
                    </div>
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                      Archive de storage
                    </span>
                    <div className="rounded-2xl border border-outline-variant bg-surface px-4 py-3">
                      <input
                        type="file"
                        accept=".tar.gz,.tgz,.tar,.gz,application/gzip,application/x-gzip"
                        onChange={(event) =>
                          setRestoreUpload((current) => ({
                            ...current,
                            storageArchive: event.target.files?.[0] ?? null,
                          }))
                        }
                        className="block w-full text-sm text-on-surface file:mr-4 file:rounded-xl file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-on-primary hover:file:opacity-90"
                      />
                      <p className="mt-2 text-xs text-on-surface-variant">
                        {restoreUpload.storageArchive
                          ? restoreUpload.storageArchive.name
                          : "Ningún archivo seleccionado"}
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 rounded-2xl border border-outline-variant bg-surface px-4 py-3">
                    <input
                      type="checkbox"
                      checked={restoreUpload.confirmRestore}
                      onChange={(event) =>
                        setRestoreUpload((current) => ({
                          ...current,
                          confirmRestore: event.target.checked,
                        }))
                      }
                      className="mt-1 h-4 w-4 rounded border-outline-variant bg-surface text-primary accent-primary"
                    />
                    <span className="text-sm text-on-surface-variant">
                      Confirmo que esta operación sobrescribirá la base de datos
                      y el storage del entorno actual.
                    </span>
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={
                      uploadingRestore ||
                      !restoreUpload.confirmRestore ||
                      !restoreUpload.databaseDump ||
                      !restoreUpload.storageArchive
                    }
                    onClick={() => void restoreFromFiles()}
                    className="inline-flex h-11 items-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-on-primary transition-colors hover:opacity-90 disabled:opacity-50"
                  >
                    <Upload className="h-4 w-4" />
                    Restaurar ahora
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setRestoreUpload({
                        confirmRestore: false,
                        databaseDump: null,
                        storageArchive: null,
                      })
                    }
                    className="inline-flex h-11 items-center gap-2 rounded-2xl border border-outline-variant bg-surface px-4 text-sm font-semibold text-on-surface transition-colors hover:border-primary"
                  >
                    <FileUp className="h-4 w-4" />
                    Limpiar archivos
                  </button>
                </div>
              </div>

              <div className="rounded-[28px] border border-outline-variant bg-surface-container p-5 shadow-elevation-1">
                <h2 className="text-lg font-semibold tracking-tight text-on-surface">
                  Historial de backups
                </h2>
                <p className="mt-1 text-sm text-on-surface-variant">
                  {backups.length} backups guardados en total. Disponible para
                  descarga y restauración.
                </p>

                <div className="mt-4 grid gap-3">
                  {backups.length ? (
                    backups.map((backup) => (
                      <div
                        key={backup.id}
                        className="rounded-2xl border border-outline-variant bg-surface px-4 py-3"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-base font-semibold text-on-surface">
                                {backup.label ?? backup.archiveFileName}
                              </h3>
                              <span className="rounded-full border border-outline-variant bg-surface-container px-2.5 py-1 text-[11px] font-semibold text-on-surface-variant">
                                {backup.status}
                              </span>
                              <span className="rounded-full border border-outline-variant bg-surface-container px-2.5 py-1 text-[11px] font-semibold text-on-surface-variant">
                                {scopeLabel(scopeFromBackup(backup))}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-on-surface-variant">
                              {backup.source} · {formatBytes(backup.sizeBytes)}{" "}
                              · {backup.createdBy?.fullName ?? "Sistema"}
                            </p>
                            <p className="mt-1 text-xs text-on-surface-variant">
                              {backup.createdAt}
                            </p>
                            {backup.errorMessage && (
                              <p className="danger-surface mt-2 rounded-2xl px-3 py-2 text-sm">
                                {backup.errorMessage}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <a
                              href={apiUrl(backup.downloadUrl)}
                              className="inline-flex h-10 items-center gap-2 rounded-2xl border border-outline-variant bg-surface-container px-3 text-sm font-semibold text-on-surface transition-colors hover:border-primary"
                            >
                              <Download className="h-4 w-4" />
                              Paquete
                            </a>
                            {backup.databaseDumpFileName &&
                              backup.databaseDownloadUrl && (
                                <a
                                  href={apiUrl(backup.databaseDownloadUrl)}
                                  className="inline-flex h-10 items-center gap-2 rounded-2xl border border-outline-variant bg-surface-container px-3 text-sm font-semibold text-on-surface transition-colors hover:border-primary"
                                >
                                  <Database className="h-4 w-4" />
                                  DB
                                </a>
                              )}
                            {backup.includeStorage &&
                              backup.storageDownloadUrl && (
                                <a
                                  href={apiUrl(backup.storageDownloadUrl)}
                                  className="inline-flex h-10 items-center gap-2 rounded-2xl border border-outline-variant bg-surface-container px-3 text-sm font-semibold text-on-surface transition-colors hover:border-primary"
                                >
                                  <Archive className="h-4 w-4" />
                                  Storage
                                </a>
                              )}
                            <button
                              type="button"
                              disabled={
                                restoringId === backup.id ||
                                backup.status !== "COMPLETED"
                              }
                              onClick={() => void restoreBackup(backup.id)}
                              className="warning-surface-strong inline-flex h-10 items-center gap-2 rounded-2xl px-3 text-sm font-semibold transition-colors disabled:opacity-50"
                            >
                              <RotateCcw className="h-4 w-4" />
                              Restaurar
                            </button>
                            <button
                              type="button"
                              disabled={deletingId === backup.id}
                              onClick={() => void deleteBackup(backup.id)}
                              className="danger-surface-strong inline-flex h-10 items-center gap-2 rounded-2xl px-3 text-sm font-semibold transition-colors disabled:opacity-50"
                            >
                              <Trash2 className="h-4 w-4" />
                              Eliminar
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <DataState>No hay backups registrados.</DataState>
                  )}
                </div>
              </div>
            </div>

            <aside className="space-y-5">
              <div className="rounded-[28px] border border-outline-variant bg-surface-container p-5 shadow-elevation-1">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight text-on-surface">
                      Configuración
                    </h2>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      Define si el módulo opera de forma programada o solo
                      manual.
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      status?.settings.isEnabled
                        ? "success-surface"
                        : "border border-outline-variant bg-surface text-on-surface-variant"
                    }`}
                  >
                    {status?.settings.isEnabled ? "Activo" : "Inactivo"}
                  </span>
                </div>

                <div className="mt-4 grid gap-3">
                  <ToggleRow
                    label="Habilitar backups programados"
                    checked={form.isEnabled}
                    onChange={(checked) =>
                      setForm((current) => ({ ...current, isEnabled: checked }))
                    }
                  />
                  <ToggleRow
                    label="Incluir base de datos"
                    checked={form.includeDatabase}
                    onChange={(checked) =>
                      setForm((current) => ({
                        ...current,
                        includeDatabase: checked,
                      }))
                    }
                  />
                  <ToggleRow
                    label="Incluir storage"
                    checked={form.includeStorage}
                    onChange={(checked) =>
                      setForm((current) => ({
                        ...current,
                        includeStorage: checked,
                      }))
                    }
                  />

                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                      Modo
                    </span>
                    <select
                      value={form.scheduleMode}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          scheduleMode: event.target
                            .value as SettingsForm["scheduleMode"],
                        }))
                      }
                      className="h-11 w-full rounded-2xl border border-outline-variant bg-surface px-4 text-sm text-on-surface outline-none transition-colors focus:border-primary"
                    >
                      <option value="MANUAL">Solo manual</option>
                      <option value="EVERY_HOURS">Cada N horas</option>
                    </select>
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                        Cada horas
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={168}
                        value={form.everyHours}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            everyHours: event.target.value,
                          }))
                        }
                        className="h-11 w-full rounded-2xl border border-outline-variant bg-surface px-4 text-sm text-on-surface outline-none transition-colors focus:border-primary"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                        Retención
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={form.retentionDays}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            retentionDays: event.target.value,
                          }))
                        }
                        className="h-11 w-full rounded-2xl border border-outline-variant bg-surface px-4 text-sm text-on-surface outline-none transition-colors focus:border-primary"
                      />
                    </label>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void saveSettings()}
                    className="inline-flex h-11 items-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-on-primary transition-colors hover:opacity-90 disabled:opacity-50"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Guardar
                  </button>
                </div>
              </div>

              <div className="rounded-[28px] border border-outline-variant bg-surface-container p-5 shadow-elevation-1">
                <h2 className="text-lg font-semibold tracking-tight text-on-surface">
                  Auditoría reciente
                </h2>
                <div className="mt-4 grid gap-3">
                  {audit.length ? (
                    audit.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-outline-variant bg-surface px-4 py-3"
                      >
                        <p className="text-sm font-semibold text-on-surface">
                          {item.action}
                        </p>
                        <p className="mt-1 text-xs text-on-surface-variant">
                          {item.entityType}
                          {item.entityId ? ` · ${item.entityId}` : ""}
                        </p>
                        <p className="mt-1 text-xs text-on-surface-variant">
                          {item.user?.fullName ?? "Sistema"} · {item.createdAt}
                        </p>
                      </div>
                    ))
                  ) : (
                    <DataState>Sin eventos de auditoría.</DataState>
                  )}
                </div>
              </div>
            </aside>
          </section>
        </>
      )}
    </AdminProtectedPage>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-[24px] border border-outline-variant bg-surface-container p-4 shadow-elevation-1">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-on-surface-variant">
            {label}
          </p>
          <p className="mt-1 text-xl font-semibold tracking-tight text-on-surface">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-medium text-on-surface">
        {value}
      </p>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between rounded-2xl border border-outline-variant bg-surface px-4 py-3 text-left transition-colors hover:border-primary"
    >
      <span className="text-sm font-medium text-on-surface">{label}</span>
      <span
        className={`relative h-6 w-11 rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-outline-variant"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow-elevation-1 transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}
