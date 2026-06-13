"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Workflow } from "lucide-react";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { PageHeader } from "@/components/ui/PageHeader";
import { NarrativeBuilderCanvasShell } from "@/components/narratives/builder/NarrativeBuilderCanvas";

export default function AdminNarrativeBuilderPage() {
  const params = useParams<{ id?: string | string[] }>();
  const rawId = params?.id;
  const narrativeId = Array.isArray(rawId) ? rawId[0] : rawId;

  return (
    <ProtectedPage requiredPermissions={["narratives:update"]}>
      <div className="space-y-6">
        <PageHeader
          title="Builder de narrativa"
          description="Diseña el flujo por nodos, valida el grafo y publica la versión operativa."
          action={
            <Link
              href="/admin/narratives"
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-outline-variant bg-surface-container px-4 text-sm font-semibold text-on-surface transition-colors hover:border-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al listado
            </Link>
          }
        />

        {!narrativeId ? (
          <div className="rounded-[28px] border border-outline-variant bg-surface-container p-6 text-sm text-on-surface-variant shadow-elevation-1">
            No se encontró el identificador de la narrativa.
          </div>
        ) : (
          <div className="rounded-[28px] border border-outline-variant bg-surface-container p-5 shadow-elevation-1">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-on-primary">
                <Workflow className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-on-surface">
                  Narrativa {narrativeId}
                </h2>
                <p className="text-sm text-on-surface-variant">
                  Edita el canvas y guarda el borrador antes de publicar.
                </p>
              </div>
            </div>

            <NarrativeBuilderCanvasShell narrativeId={narrativeId} />
          </div>
        )}
      </div>
    </ProtectedPage>
  );
}
