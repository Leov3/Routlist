"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Sparkles } from "lucide-react";
import { AdminProtectedPage } from "@/components/layout/AdminProtectedPage";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { NarrativeCreateForm } from "@/components/narratives/NarrativeCreateForm";
import { NarrativeList } from "@/components/narratives/NarrativeList";
import type { AuthUser } from "@/types/routlis";
import type { NarrativeListItem } from "@/types/narratives";

export default function AdminNarrativesPage() {
  const router = useRouter();
  const [narratives, setNarratives] = useState<NarrativeListItem[]>([]);
  const [currentOrganizationId, setCurrentOrganizationId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [me, result] = await Promise.all([
        api<{ user: AuthUser }>("/auth/me"),
        api<NarrativeListItem[]>("/narratives"),
      ]);
      setCurrentOrganizationId(me.user.organizationId);
      setNarratives(result);
    } catch {
      setNarratives([]);
      setCurrentOrganizationId("");
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
    router.push(`/admin/narratives/${created.id}/builder`);
  }

  async function duplicateNarrative(id: string) {
    await api(`/narratives/${id}/duplicate`, { method: "POST" });
    await load();
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <AdminProtectedPage>
      <div className="space-y-6">
        <PageHeader
          title="Narrativas"
          description="Constructor visual de flujos operativos para la operación diaria."
          action={
            <Link
              href="/admin/narratives/new"
              className="btn-surface-base btn-primary-surface flex h-11 w-full items-center justify-center rounded-2xl px-4 text-sm sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              Nueva narrativa
            </Link>
          }
        />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <NarrativeCreateForm onCreate={createNarrative} submitLabel="Crear y abrir builder" />

          <div className="rounded-[28px] border border-outline-variant bg-surface-container p-4 shadow-elevation-1 sm:p-5">
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
              currentOrganizationId={currentOrganizationId}
            />
          </div>
        </div>
      </div>
    </AdminProtectedPage>
  );
}
