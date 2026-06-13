"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";
import { ProtectedPage } from "@/components/layout/ProtectedPage";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { NarrativeCreateForm } from "@/components/narratives/NarrativeCreateForm";
import { NarrativeList } from "@/components/narratives/NarrativeList";
import type { NarrativeListItem } from "@/types/narratives";

export default function AdminNarrativesPage() {
  const [narratives, setNarratives] = useState<NarrativeListItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const result = await api<NarrativeListItem[]>("/narratives");
      setNarratives(result);
    } catch {
      setNarratives([]);
    } finally {
      setLoading(false);
    }
  }

  async function createNarrative(values: { title: string; description: string }) {
    const created = await api<NarrativeListItem>("/narratives", {
      method: "POST",
      body: JSON.stringify(values),
    });
    await load();
    window.location.href = `/admin/narratives/${created.id}/builder`;
  }

  async function duplicateNarrative(id: string) {
    await api(`/narratives/${id}/duplicate`, { method: "POST" });
    await load();
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <ProtectedPage requiredPermissions={["narratives:view"]}>
      <div className="space-y-6">
        <PageHeader
          title="Narrativas"
          description="Constructor visual de flujos operativos para la operación diaria."
          action={
            <Link
              href="/admin/narratives/new"
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-on-primary transition-transform hover:scale-[1.01]"
            >
              <Plus className="h-4 w-4" />
              Nueva narrativa
            </Link>
          }
        />

        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <NarrativeCreateForm onCreate={createNarrative} submitLabel="Crear y abrir builder" />

          <div className="rounded-[28px] border border-outline-variant bg-surface-container p-5 shadow-elevation-1">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-tertiary text-on-tertiary">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-on-surface">
                    Flujos disponibles
                  </h2>
                  <p className="text-sm text-on-surface-variant">
                    {loading ? "Cargando narrativas..." : `${narratives.length} narrativas encontradas`}
                  </p>
                </div>
              </div>
            </div>

            <NarrativeList
              narratives={narratives}
              onRefresh={load}
              onDuplicate={duplicateNarrative}
              canCreate
            />
          </div>
        </div>
      </div>
    </ProtectedPage>
  );
}
