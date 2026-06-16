"use client";

import { useParams } from "next/navigation";
import { AdminProtectedPage } from "@/components/layout/AdminProtectedPage";
import { NarrativeBuilderCanvasShell } from "@/components/narratives/builder/NarrativeBuilderCanvas";

export default function AdminNarrativeBuilderPage() {
  const params = useParams<{ id?: string | string[] }>();
  const rawId = params?.id;
  const narrativeId = Array.isArray(rawId) ? rawId[0] : rawId;

  return (
    <AdminProtectedPage>
      {!narrativeId ? (
        <div className="rounded-2xl border border-outline-variant bg-surface-container p-6 text-sm text-on-surface-variant shadow-elevation-1">
          No se encontró el identificador de la narrativa.
        </div>
      ) : (
        <NarrativeBuilderCanvasShell narrativeId={narrativeId} />
      )}
    </AdminProtectedPage>
  );
}
