"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Copy, Plus, Save, Search, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { MailModuleShell } from "@/components/admin/mail/MailModuleShell";
import { api, ApiError } from "@/lib/api";

type MailEvent = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isEnabled: boolean;
  templateKey: string | null;
  channels?: unknown;
  updatedAt: string;
};

type MailTemplate = {
  key: string;
  name: string;
  subject: string;
};

type EventForm = {
  key: string;
  name: string;
  description: string;
  templateKey: string;
  isEnabled: boolean;
};

type Filter = "all" | "active" | "inactive";

const emptyForm: EventForm = {
  key: "",
  name: "",
  description: "",
  templateKey: "",
  isEnabled: true,
};

const eventSeeds = [
  { key: "USER_CREATED", name: "Usuario creado" },
  { key: "INVITE_SENT", name: "Invitación enviada" },
  { key: "PASSWORD_RESET_REQUESTED", name: "Recuperación de contraseña" },
  { key: "STORAGE_HIGH", name: "Alerta por almacenamiento alto" },
  { key: "NARRATIVE_READY", name: "Narrativa lista" },
  { key: "AUDIO_PROCESSED", name: "Audio procesado" },
  { key: "AUDIO_ERROR", name: "Error de procesamiento" },
  { key: "LICENSE_EXPIRING", name: "Licencia próxima a vencer" },
];

export default function MailEventsPage() {
  const [events, setEvents] = useState<MailEvent[]>([]);
  const [templates, setTemplates] = useState<MailTemplate[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [form, setForm] = useState<EventForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [message, setMessage] = useState<string | null>(null);

  async function load(nextSelectedKey?: string | null) {
    setLoading(true);
    try {
      const [eventsResult, templatesResult] = await Promise.all([
        api<MailEvent[]>("/admin/mail/events"),
        api<MailTemplate[]>("/admin/mail/templates"),
      ]);
      setEvents(eventsResult);
      setTemplates(templatesResult);
      const key = nextSelectedKey ?? selectedKey ?? eventsResult[0]?.key ?? null;
      if (key) {
        const current = eventsResult.find((event) => event.key === key);
        if (current) selectEvent(current);
      } else {
        setSelectedKey(null);
        setForm(emptyForm);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectEvent(event: MailEvent) {
    setSelectedKey(event.key);
    setForm({
      key: event.key,
      name: event.name,
      description: event.description ?? "",
      templateKey: event.templateKey ?? "",
      isEnabled: event.isEnabled,
    });
  }

  function startNew() {
    setSelectedKey(null);
    const seed = eventSeeds[events.length % eventSeeds.length];
    setForm({
      ...emptyForm,
      key: seed.key,
      name: seed.name,
    });
    setMessage("Define el evento y asígnale una plantilla si corresponde.");
  }

  function duplicateCurrent() {
    setSelectedKey(null);
    setForm((current) => ({
      ...current,
      key: `${current.key || "CUSTOM_EVENT"}_COPY`,
      name: `${current.name || "Evento"} (copia)`,
    }));
    setMessage("Evento duplicado. Ajusta la clave antes de guardar.");
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const targetKey = selectedKey ?? form.key.trim();
      if (!targetKey) throw new Error("La clave del evento es obligatoria.");

      await api(`/admin/mail/events/${encodeURIComponent(targetKey)}`, {
        method: "PUT",
        body: JSON.stringify({
          templateKey: form.templateKey.trim() || undefined,
          isEnabled: form.isEnabled,
        }),
      });
      setMessage("Evento guardado.");
      await load(targetKey);
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : (error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const filteredEvents = useMemo(() => {
    const term = search.trim().toLowerCase();
    return events.filter((event) => {
      const matchesSearch =
        !term ||
        [event.name, event.key, event.description ?? ""].join(" ").toLowerCase().includes(term);
      const matchesFilter =
        filter === "all" ||
        (filter === "active" && event.isEnabled) ||
        (filter === "inactive" && !event.isEnabled);
      return matchesSearch && matchesFilter;
    });
  }, [events, filter, search]);

  const selectedEvent = useMemo(
    () => events.find((event) => event.key === selectedKey) ?? null,
    [events, selectedKey],
  );

  return (
    <MailModuleShell
      onReload={() => void load(selectedKey)}
      action={
        <button
          type="button"
          onClick={startNew}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-elevation-1 transition hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Nuevo evento
        </button>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-[28px] border border-outline-variant bg-surface-container p-4 shadow-elevation-1">
          <div className="mb-3">
            <h2 className="text-lg font-semibold text-on-surface">Eventos de correo</h2>
            <p className="text-sm text-on-surface-variant">
              Define qué acciones de Routlis generan notificaciones automáticas.
            </p>
          </div>

          <label className="mb-3 flex items-center gap-2 rounded-2xl border border-outline-variant bg-surface-container-high px-3 py-2.5">
            <Search className="h-4 w-4 text-on-surface-variant" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar evento"
              className="w-full bg-transparent text-sm outline-none placeholder:text-on-surface-variant"
            />
          </label>

          <div className="mb-3 flex flex-wrap gap-2">
            {[
              { key: "all", label: "Todos" },
              { key: "active", label: "Activos" },
              { key: "inactive", label: "Inactivos" },
            ].map((item) => {
              const active = filter === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setFilter(item.key as Filter)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "border-primary bg-primary text-on-primary"
                      : "border-outline-variant bg-surface-container text-on-surface-variant hover:border-primary hover:text-on-surface"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1 lg:max-h-[68vh]">
            {loading ? (
              <div className="rounded-2xl border border-outline-variant bg-surface-container-high px-4 py-10 text-center text-sm text-on-surface-variant">
                Cargando eventos...
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="rounded-2xl border border-outline-variant bg-surface-container-high px-4 py-10 text-center text-sm text-on-surface-variant">
                No hay eventos que coincidan.
              </div>
            ) : (
              filteredEvents.map((event) => {
                const active = event.key === selectedKey;
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => selectEvent(event)}
                    className={`w-full rounded-2xl border p-3 text-left transition ${
                      active
                        ? "border-primary bg-primary/10 shadow-elevation-1"
                        : "border-outline-variant bg-surface-container-high hover:border-primary/40 hover:bg-primary/5"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-on-surface">{event.name}</p>
                        <p className="truncate text-[11px] uppercase tracking-[0.18em] text-on-surface-variant">
                          {event.key}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                          event.isEnabled ? "success-surface" : "bg-outline-variant/30 text-on-surface-variant"
                        }`}
                      >
                        {event.isEnabled ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-on-surface-variant">
                      {event.description ?? "Sin descripción"}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="space-y-4">
          {message && (
            <div className="rounded-2xl border border-outline-variant bg-surface-container px-4 py-3 text-sm text-on-surface">
              {message}
            </div>
          )}

          <form onSubmit={onSave} className="space-y-4">
            <div className="rounded-[28px] border border-outline-variant bg-surface-container p-4 shadow-elevation-1 sm:p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-semibold text-on-surface">
                    {selectedEvent?.name || form.name || "Nuevo evento"}
                  </h2>
                  <p className="mt-1 truncate text-sm text-on-surface-variant">
                    {selectedEvent?.key || form.key || "Sin clave"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, isEnabled: !current.isEnabled }))}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition ${
                    form.isEnabled
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-outline-variant bg-surface-container-high text-on-surface-variant"
                  }`}
                >
                  {form.isEnabled ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                  {form.isEnabled ? "Activo" : "Inactivo"}
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary shadow-elevation-1 transition hover:opacity-90 disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {saving ? "Guardando..." : "Guardar evento"}
                </button>
                <button
                  type="button"
                  onClick={duplicateCurrent}
                  className="inline-flex items-center gap-2 rounded-full border border-outline-variant px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:border-primary hover:text-on-surface"
                >
                  <Copy className="h-4 w-4" />
                  Duplicar
                </button>
                <button
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, isEnabled: !current.isEnabled }))}
                  className="inline-flex items-center gap-2 rounded-full border border-primary px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/10"
                >
                  Cambiar estado
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedKey(null);
                    setForm(emptyForm);
                    setMessage("Selecciona o crea un evento para editarlo.");
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-error px-4 py-2.5 text-sm font-semibold text-error transition hover:bg-error/5"
                >
                  <Trash2 className="h-4 w-4" />
                  Limpiar
                </button>
              </div>
            </div>

            <div className="rounded-[28px] border border-outline-variant bg-surface-container p-4 shadow-elevation-1 sm:p-5">
              <h3 className="text-lg font-semibold text-on-surface">Datos básicos</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="Nombre">
                  <input
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    className={inputClass}
                    disabled={Boolean(selectedEvent)}
                  />
                </Field>
                <Field label="Clave">
                  <input
                    value={form.key}
                    onChange={(event) => setForm((current) => ({ ...current, key: event.target.value }))}
                    className={inputClass}
                    disabled={Boolean(selectedEvent)}
                  />
                </Field>
              </div>
              <div className="mt-4 grid gap-4">
                <Field label="Descripción">
                  <textarea
                    value={form.description}
                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                    className={`${inputClass} min-h-[88px]`}
                    disabled={Boolean(selectedEvent)}
                  />
                </Field>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="Plantilla asociada">
                  <select
                    value={form.templateKey}
                    onChange={(event) => setForm((current) => ({ ...current, templateKey: event.target.value }))}
                    className={inputClass}
                  >
                    <option value="">Sin plantilla</option>
                    {templates.map((template) => (
                      <option key={template.key} value={template.key}>
                        {template.name} ({template.key})
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Estado">
                  <div className="flex h-10 items-center rounded-xl border border-outline-variant bg-surface-container-high px-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${form.isEnabled ? "success-surface" : "bg-outline-variant/30 text-on-surface-variant"}`}>
                      {form.isEnabled ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                </Field>
              </div>
            </div>

            <div className="rounded-[28px] border border-outline-variant bg-surface-container p-4 shadow-elevation-1 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-on-surface">Referencia</h3>
                  <p className="text-sm text-on-surface-variant">
                    Asocia cada evento con una plantilla de correo cuando aplique.
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${form.isEnabled ? "success-surface" : "bg-outline-variant/30 text-on-surface-variant"}`}>
                  {form.isEnabled ? "Activo" : "Inactivo"}
                </span>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_0.95fr]">
                <div className="rounded-[24px] border border-outline-variant bg-surface-container-high p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-on-surface-variant">Evento seleccionado</p>
                  <p className="mt-1 text-lg font-semibold text-on-surface">
                    {selectedEvent?.name || form.name || "Sin selección"}
                  </p>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    {selectedEvent?.description || form.description || "Elige un evento del catálogo."}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {form.templateKey ? (
                      <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                        Plantilla: {form.templateKey}
                      </span>
                    ) : (
                      <span className="rounded-full border border-outline-variant px-3 py-1 text-xs text-on-surface-variant">
                        Sin plantilla asignada
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-[24px] border border-outline-variant bg-surface-container-high p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-on-surface-variant">Plantillas disponibles</p>
                  <div className="mt-3 max-h-[240px] space-y-2 overflow-auto pr-1">
                    {templates.map((template) => (
                      <button
                        key={template.key}
                        type="button"
                        onClick={() => setForm((current) => ({ ...current, templateKey: template.key }))}
                        className={`w-full rounded-2xl border px-3 py-2 text-left transition ${
                          form.templateKey === template.key
                            ? "border-primary bg-primary/10"
                            : "border-outline-variant bg-surface-container hover:border-primary/40 hover:bg-primary/5"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-on-surface">{template.name}</p>
                            <p className="truncate text-xs text-on-surface-variant">{template.key}</p>
                          </div>
                          <span className="rounded-full border border-outline-variant px-2 py-1 text-[10px] text-on-surface-variant">
                            Seleccionar
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </form>
        </section>
      </div>
    </MailModuleShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="text-xs font-semibold uppercase tracking-[0.22em] text-on-surface-variant">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "h-10 w-full rounded-xl border border-outline-variant bg-surface-container-high px-3 text-sm text-on-surface outline-none focus:border-primary disabled:opacity-60";
