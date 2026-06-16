"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  CheckCircle,
  HardDrive,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import { AdminProtectedPage } from "@/components/layout/AdminProtectedPage";
import { DataState } from "@/components/ui/DataState";
import { PageHeader } from "@/components/ui/PageHeader";
import { api, formatBytes } from "@/lib/api";
import type { AudioAsset } from "@/types/routlis";

type StatusFilter = "all" | "active" | "inactive";
type SortKey = "originalName" | "sizeBytes" | "mimeType" | "isActive";
type BulkAction = "ACTIVATE" | "DEACTIVATE" | "DELETE";

type StorageHealth = {
  filesystem: {
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    usedPercent: number;
  };
  usage: {
    audioAssetsBytes: number;
    appBytes: number;
    localDatabaseBytes: number;
    trackedBytes: number;
  };
  paths: {
    audioPath: string;
  };
};

export default function StoragePage() {
  const [audios, setAudios] = useState<AudioAsset[]>([]);
  const [storage, setStorage] = useState<StorageHealth | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("sizeBytes");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  async function load() {
    setLoading(true);
    const [audioResult, storageResult] = await Promise.allSettled([
      api<AudioAsset[]>("/audio-assets"),
      api<StorageHealth>("/health/storage"),
    ]);

    setAudios(audioResult.status === "fulfilled" ? audioResult.value : []);
    setStorage(storageResult.status === "fulfilled" ? storageResult.value : null);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredAudios = useMemo(() => {
    const term = search.trim().toLowerCase();

    return audios
      .filter((audio) => {
        const matchesSearch = `${audio.originalName} ${audio.mimeType}`
          .toLowerCase()
          .includes(term);
        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "active" && audio.isActive) ||
          (statusFilter === "inactive" && !audio.isActive);

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        const left = a[sortKey];
        const right = b[sortKey];
        const result =
          typeof left === "number" && typeof right === "number"
            ? left - right
            : String(left).localeCompare(String(right));

        return sortDirection === "asc" ? result : -result;
      });
  }, [audios, search, sortDirection, sortKey, statusFilter]);

  const selectedAudios = useMemo(
    () => audios.filter((audio) => selectedIds.includes(audio.id)),
    [audios, selectedIds],
  );
  const selectedBytes = selectedAudios.reduce(
    (total, audio) => total + audio.sizeBytes,
    0,
  );

  function sortBy(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  }

  function toggleSelection(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id],
    );
  }

  function toggleVisibleSelection() {
    const visibleIds = filteredAudios.map((audio) => audio.id);
    const allVisibleSelected = visibleIds.every((id) => selectedIds.includes(id));

    setSelectedIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : [...new Set([...current, ...visibleIds])],
    );
  }

  async function runBulk(action: BulkAction) {
    if (!selectedIds.length) return;

    setWorking(true);
    await api("/audio-assets/bulk", {
      method: "POST",
      body: JSON.stringify({ ids: selectedIds, action }),
    });
    setSelectedIds([]);
    await load();
    setWorking(false);
  }

  return (
    <AdminProtectedPage>
      <PageHeader
        title="Almacenamiento de audios"
        description="Gestion masiva de audios, estado y consumo de disco."
      />

      <section className="mb-5 grid gap-3 md:grid-cols-4">
        <StorageCard
          label="Audios"
          value={formatBytes(storage?.usage.audioAssetsBytes ?? 0)}
          detail={`${audios.length} archivos registrados`}
        />
        <StorageCard
          label="Seleccion actual"
          value={formatBytes(selectedBytes)}
          detail={`${selectedIds.length} audios seleccionados`}
        />
        <StorageCard
          label="Filesystem usado"
          value={`${storage?.filesystem.usedPercent ?? 0}%`}
          detail={
            storage
              ? `${formatBytes(storage.filesystem.usedBytes)} de ${formatBytes(storage.filesystem.totalBytes)}`
              : "Sin lectura"
          }
        />
        <StorageCard
          label="Ruta audios"
          value="Storage"
          detail={storage?.paths.audioPath ?? "Sin lectura"}
        />
      </section>

      <section className="mb-5 grid gap-3 rounded-xl border border-outline-variant bg-surface-container p-4 xl:grid-cols-[1fr_180px_auto_auto_auto]">
        <label className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filtrar por nombre o tipo"
            className="h-10 w-full rounded-xl border border-outline pl-10 pr-3 text-sm"
          />
        </label>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          className="h-10 rounded-xl border border-outline px-3 text-sm"
        >
          <option value="all">Todos</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
        <button
          type="button"
          disabled={!selectedIds.length || working}
          onClick={() => void runBulk("ACTIVATE")}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-outline px-3 text-sm font-semibold disabled:opacity-50"
        >
          <CheckCircle className="h-4 w-4" />
          Activar
        </button>
        <button
          type="button"
          disabled={!selectedIds.length || working}
          onClick={() => void runBulk("DEACTIVATE")}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-outline px-3 text-sm font-semibold disabled:opacity-50"
        >
          <XCircle className="h-4 w-4" />
          Desactivar
        </button>
        <button
          type="button"
          disabled={!selectedIds.length || working}
          onClick={() => void runBulk("DELETE")}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-red-700 px-3 text-sm font-semibold text-on-primary disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          Eliminar
        </button>
      </section>

      {loading ? (
        <DataState>Cargando almacenamiento...</DataState>
      ) : filteredAudios.length ? (
        <div className="overflow-x-auto rounded-xl border border-outline-variant bg-surface-container">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-surface-container-high text-xs uppercase text-on-surface-variant">
              <tr>
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={
                      filteredAudios.length > 0 &&
                      filteredAudios.every((audio) => selectedIds.includes(audio.id))
                    }
                    onChange={toggleVisibleSelection}
                  />
                </th>
                <th className="px-4 py-3">
                  <button onClick={() => sortBy("originalName")} className="inline-flex items-center gap-1">
                    <ArrowUpDown className="h-3 w-3" />
                    Audio
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button onClick={() => sortBy("mimeType")} className="inline-flex items-center gap-1">
                    <ArrowUpDown className="h-3 w-3" />
                    Tipo
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button onClick={() => sortBy("sizeBytes")} className="inline-flex items-center gap-1">
                    <ArrowUpDown className="h-3 w-3" />
                    Tamano
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button onClick={() => sortBy("isActive")} className="inline-flex items-center gap-1">
                    <ArrowUpDown className="h-3 w-3" />
                    Estado
                  </button>
                </th>
                <th className="px-4 py-3">Creado</th>
              </tr>
            </thead>
            <tbody>
              {filteredAudios.map((audio) => (
                <tr key={audio.id} className="border-t border-outline-variant">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(audio.id)}
                      onChange={() => toggleSelection(audio.id)}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium">{audio.originalName}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{audio.mimeType}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{formatBytes(audio.sizeBytes)}</td>
                  <td className="px-4 py-3">{audio.isActive ? "Activo" : "Inactivo"}</td>
                  <td className="px-4 py-3 text-on-surface-variant">
                    {new Date(audio.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <DataState>No hay audios para gestionar.</DataState>
      )}
    </AdminProtectedPage>
  );
}

function StorageCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-on-surface-variant">{label}</p>
        <HardDrive className="h-4 w-4 text-primary" />
      </div>
      <p className="text-2xl font-semibold text-on-surface">{value}</p>
      <p className="mt-2 truncate text-xs text-on-surface-variant" title={detail}>
        {detail}
      </p>
    </div>
  );
}
