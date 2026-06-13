"use client";

import { useParams } from "next/navigation";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { NarrativeBuilderCanvasShell } from "@/components/narratives/builder/NarrativeBuilderCanvas";

export default function AdminNarrativeBuilderPage() {
  const params = useParams<{ id?: string | string[] }>();
  const rawId = params?.id;
  const narrativeId = Array.isArray(rawId) ? rawId[0] : rawId;

  return (
    <ProtectedPage requiredPermissions={["narratives:update"]}>
      {!narrativeId ? (
        <div className="rounded-2xl border border-outline-variant bg-surface-container p-6 text-sm text-on-surface-variant shadow-elevation-1">
          No se encontró el identificador de la narrativa.
        </div>
      ) : (
        <NarrativeBuilderCanvasShell narrativeId={narrativeId} />
      )}
    </ProtectedPage>
  );
}
