"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { AdminProtectedPage } from "@/components/layout/AdminProtectedPage";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { NarrativeCreateForm } from "@/components/narratives/NarrativeCreateForm";
import type { NarrativeListItem } from "@/types/narratives";

export default function AdminNarrativesNewPage() {
  const router = useRouter();

  async function createNarrative(values: { title: string; description: string }) {
    const created = await api<NarrativeListItem>("/narratives", {
      method: "POST",
      body: JSON.stringify(values),
    });

    router.push(`/admin/narratives/${created.id}/builder`);
  }

  return (
    <AdminProtectedPage>
      <div className="space-y-6">
        <PageHeader
          title="Nueva narrativa"
          description="Crea un borrador para comenzar a diseñar el flujo operativo."
          action={
            <Link
              href="/admin/narratives"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-outline-variant bg-surface-container px-4 text-sm font-semibold text-on-surface transition-colors hover:border-primary sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al listado
            </Link>
          }
        />

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <NarrativeCreateForm
            onCreate={createNarrative}
            submitLabel="Crear y abrir builder"
          />

          <section className="rounded-[28px] border border-outline-variant bg-surface-container p-4 shadow-elevation-1 sm:p-5">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-tertiary text-on-tertiary">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-on-surface">
                  Recomendación
                </h2>
                <p className="text-sm text-on-surface-variant">
                  Usa títulos cortos y orientados a operación. El builder te llevará
                  directamente a la edición visual del flujo.
                </p>
              </div>
            </div>

            <div className="rounded-[24px] border border-dashed border-outline-variant bg-surface px-4 py-5 text-sm text-on-surface-variant">
              <p className="font-medium text-on-surface">Siguiente paso</p>
              <p className="mt-2">
                Después de crearla, podrás agregar nodos, conectar el flujo, validar y
                publicar la narrativa desde el builder.
              </p>
            </div>
          </section>
        </div>
      </div>
    </AdminProtectedPage>
  );
}
