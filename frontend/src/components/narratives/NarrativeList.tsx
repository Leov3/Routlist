"use client";

import Link from "next/link";
import { ArrowUpRight, Copy, Edit3, RefreshCw } from "lucide-react";
import type { NarrativeListItem } from "@/types/narratives";
import { DataState } from "@/components/ui/DataState";

type NarrativeListProps = {
  narratives: NarrativeListItem[];
  onRefresh: () => void;
  onDuplicate: (id: string) => Promise<void>;
  canCreate: boolean;
};

function narrativeStatusLabel(status: NarrativeListItem["status"]) {
  if (status === "ACTIVE") return "Activa";
  if (status === "ARCHIVED") return "Archivada";
  return "Borrador";
}

function formatRelativeDate(value?: string) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const diffMs = date.getTime() - Date.now();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (Math.abs(diffHours) < 24) {
    return diffHours === 0
      ? "hace un momento"
      : diffHours > 0
        ? `en ${diffHours} h`
        : `hace ${Math.abs(diffHours)} h`;
  }

  return diffDays > 0 ? `en ${diffDays} días` : `hace ${Math.abs(diffDays)} días`;
}

export function NarrativeList({
  narratives,
  onRefresh,
  onDuplicate,
  canCreate,
}: NarrativeListProps) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-on-surface">
            Narrativas
          </h2>
          <p className="text-sm text-on-surface-variant">
            Diseña flujos operativos y ejecútalos desde el player guiado.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex h-10 items-center gap-2 rounded-2xl border border-outline-variant bg-surface-container px-4 text-sm font-medium text-on-surface transition-colors hover:border-primary"
        >
          <RefreshCw className="h-4 w-4" />
          Recargar
        </button>
      </div>

      {narratives.length > 0 ? (
        <div className="overflow-hidden rounded-[28px] border border-outline-variant bg-surface-container shadow-elevation-1">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-surface-container-high text-xs uppercase tracking-widest text-on-surface-variant">
              <tr>
                <th className="px-5 py-3">Narrativa</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3">Versiones</th>
                <th className="px-5 py-3">Actualizada</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {narratives.map((narrative) => (
                <tr key={narrative.id} className="border-t border-outline-variant">
                  <td className="px-5 py-4">
                    <div className="space-y-1">
                      <p className="font-semibold text-on-surface">{narrative.title}</p>
                      <p className="max-w-[420px] truncate text-xs text-on-surface-variant">
                        {narrative.description || "Sin descripción"}
                      </p>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex rounded-full border border-outline-variant bg-surface px-3 py-1 text-xs font-semibold text-on-surface">
                      {narrativeStatusLabel(narrative.status)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-on-surface-variant">
                    {narrative._count?.versions ?? 0} versiones
                    {narrative.publishedVersion?.versionNumber ? (
                      <span className="block text-xs">
                        Publicada v{narrative.publishedVersion.versionNumber}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-5 py-4 text-sm text-on-surface-variant">
                    {formatRelativeDate(narrative.updatedAt)}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/narratives/${narrative.id}/builder`}
                        className="inline-flex h-9 items-center gap-2 rounded-2xl border border-outline-variant bg-surface px-3 text-xs font-semibold text-on-surface transition-colors hover:border-primary"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Builder
                      </Link>
                      <button
                        type="button"
                        onClick={() => void onDuplicate(narrative.id)}
                        className="inline-flex h-9 items-center gap-2 rounded-2xl border border-outline-variant bg-surface px-3 text-xs font-semibold text-on-surface transition-colors hover:border-primary"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Duplicar
                      </button>
                      <Link
                        href={`/narratives/${narrative.id}/run`}
                        className="inline-flex h-9 items-center gap-2 rounded-2xl bg-primary px-3 text-xs font-semibold text-on-primary transition-transform hover:scale-[1.01]"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        Ejecutar
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <DataState>
          <div className="flex flex-col items-center gap-2 text-center">
            <p>No hay narrativas todavía.</p>
            {canCreate ? (
              <p className="text-xs text-on-surface-variant">
                Crea la primera para empezar a construir el flujo.
              </p>
            ) : null}
          </div>
        </DataState>
      )}
    </section>
  );
}
