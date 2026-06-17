"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Save, ShieldCheck, Trash2 } from "lucide-react";
import { AdminProtectedPage } from "@/components/layout/AdminProtectedPage";
import { PageHeader } from "@/components/ui/PageHeader";
import { api, apiUrl } from "@/lib/api";
import type { PlatformBranding } from "@/types/routlis";

const EMPTY_FORM = {
  platformName: "Routlis",
  tagline: "",
  primaryColor: "",
  secondaryColor: "",
};

export default function AdminPlatformPage() {
  const [branding, setBranding] = useState<PlatformBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [logo, setLogo] = useState<File | null>(null);
  const [favicon, setFavicon] = useState<File | null>(null);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    setError(null);
    try {
      const data = await api<PlatformBranding>("/platform-branding");
      setBranding(data);
      setForm({
        platformName: data.platformName ?? "Routlis",
        tagline: data.tagline ?? "",
        primaryColor: data.primaryColor ?? "",
        secondaryColor: data.secondaryColor ?? "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la personalización.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("platformName", form.platformName);
      if (form.tagline) body.set("tagline", form.tagline);
      if (form.primaryColor) body.set("primaryColor", form.primaryColor);
      if (form.secondaryColor) body.set("secondaryColor", form.secondaryColor);
      if (logo) body.set("logo", logo);
      if (favicon) body.set("favicon", favicon);
      await api<PlatformBranding>("/platform-branding", { method: "PATCH", body, formData: true });
      setLogo(null);
      setFavicon(null);
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la personalización.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminProtectedPage>
      <div className="space-y-6">
        <PageHeader
          title="Personalización de plataforma"
          description="Configura la identidad global de Routlis: logo, favicon y nombre visible."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => void load(true)} className="btn-surface-base btn-secondary-surface inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm">
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                Recargar
              </button>
              <button type="button" onClick={() => void handleSave()} className="btn-surface-base btn-primary-surface inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm">
                <Save className="h-4 w-4" />
                Guardar cambios
              </button>
            </div>
          }
        />

        {error ? <p className="text-sm text-error">{error}</p> : null}

        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <section className="rounded-[24px] border border-outline-variant bg-surface-container p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-on-surface">Activos</h3>
                <p className="text-sm text-on-surface-variant">Logo y favicon actuales.</p>
              </div>
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>

            <div className="mt-4 space-y-4">
              <AssetPreview label="Logo" url={branding?.logoUrl ? apiUrl(branding.logoUrl) : null} />
              <AssetPreview label="Favicon" url={branding?.faviconUrl ? apiUrl(branding.faviconUrl) : null} compact />
            </div>
          </section>

          <section className="rounded-[24px] border border-outline-variant bg-surface-container p-5 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.18em] text-on-surface-variant">Nombre visible</span>
                <input className="input-surface h-11 rounded-2xl px-3 text-sm outline-none" value={form.platformName} onChange={(event) => setForm((current) => ({ ...current, platformName: event.target.value }))} />
              </label>
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.18em] text-on-surface-variant">Tagline</span>
                <input className="input-surface h-11 rounded-2xl px-3 text-sm outline-none" value={form.tagline} onChange={(event) => setForm((current) => ({ ...current, tagline: event.target.value }))} />
              </label>
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.18em] text-on-surface-variant">Color principal</span>
                <input className="input-surface h-11 rounded-2xl px-3 text-sm outline-none" value={form.primaryColor} onChange={(event) => setForm((current) => ({ ...current, primaryColor: event.target.value }))} placeholder="#6f42ff" />
              </label>
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.18em] text-on-surface-variant">Color secundario</span>
                <input className="input-surface h-11 rounded-2xl px-3 text-sm outline-none" value={form.secondaryColor} onChange={(event) => setForm((current) => ({ ...current, secondaryColor: event.target.value }))} placeholder="#b8a3ff" />
              </label>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 rounded-[20px] border border-dashed border-outline-variant p-4">
                <span className="text-xs uppercase tracking-[0.18em] text-on-surface-variant">Subir logo</span>
                <input type="file" accept="image/*" onChange={(event) => setLogo(event.target.files?.[0] ?? null)} />
              </label>
              <label className="grid gap-2 rounded-[20px] border border-dashed border-outline-variant p-4">
                <span className="text-xs uppercase tracking-[0.18em] text-on-surface-variant">Subir favicon</span>
                <input type="file" accept=".ico,image/*" onChange={(event) => setFavicon(event.target.files?.[0] ?? null)} />
              </label>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => void handleSave()} className="btn-surface-base btn-primary-surface inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm">
                <Save className="h-4 w-4" />
                Guardar cambios
              </button>
              <button type="button" onClick={() => { setForm(EMPTY_FORM); setLogo(null); setFavicon(null); }} className="btn-surface-base btn-secondary-surface inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm">
                <Trash2 className="h-4 w-4" />
                Limpiar
              </button>
              {loading ? <p className="text-sm text-on-surface-variant">Cargando...</p> : null}
              {saving ? <p className="text-sm text-on-surface-variant">Guardando...</p> : null}
            </div>
          </section>
        </div>
      </div>
    </AdminProtectedPage>
  );
}

function AssetPreview({ label, url, compact = false }: { label: string; url: string | null; compact?: boolean }) {
  return (
    <div className="rounded-[20px] border border-outline-variant bg-surface-container-high p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-on-surface-variant">{label}</p>
      <div className={`mt-3 overflow-hidden rounded-[18px] border border-outline-variant bg-surface ${compact ? "h-20" : "h-40"}`}>
        {url ? <img src={url} alt={label} className="h-full w-full object-contain p-4" /> : <div className="flex h-full items-center justify-center text-sm text-on-surface-variant">Sin {label.toLowerCase()} configurado</div>}
      </div>
    </div>
  );
}
