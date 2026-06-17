"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, Copy, Mail, Plus, Save, Search, Send, Sparkles, Trash2, TriangleAlert } from "lucide-react";
import { MailModuleShell } from "@/components/admin/mail/MailModuleShell";
import { api, ApiError } from "@/lib/api";

type MailTemplate = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  subject: string;
  htmlBody: string;
  textBody: string | null;
  isActive: boolean;
  updatedAt: string;
};

type TemplateForm = {
  key: string;
  name: string;
  description: string;
  subject: string;
  htmlBody: string;
  cssExtra: string;
  textBody: string;
  isActive: boolean;
};

type Filter = "all" | "active" | "inactive";
type EditorTab = "html" | "text" | "variables" | "preview" | "test";
type NoticeTone = "success" | "error" | "info";

type Notice = {
  tone: NoticeTone;
  text: string;
};

const emptyForm: TemplateForm = {
  key: "",
  name: "",
  description: "",
  subject: "",
  htmlBody:
    "<!doctype html><html><head><meta charset=\"utf-8\"></head><body><h1>Plantilla</h1><p>Contenido...</p></body></html>",
  cssExtra: "body{font-family:Arial,sans-serif}",
  textBody: "",
  isActive: true,
};

const variableChips = [
  "{{user_name}}",
  "{{organization_name}}",
  "{{platform_name}}",
  "{{login_url}}",
  "{{reset_url}}",
  "{{audio_title}}",
  "{{license_expiration}}",
  "{{storage_used}}",
];

const testVariables = [
  { key: "user_name", value: "María López" },
  { key: "organization_name", value: "Routlis" },
  { key: "platform_name", value: "Routlis" },
  { key: "login_url", value: "https://routlis.local/login" },
  { key: "reset_url", value: "https://routlis.local/reset-password" },
  { key: "audio_title", value: "Audio de ejemplo" },
  { key: "license_expiration", value: "30 días" },
  { key: "storage_used", value: "72%" },
];

const defaultTemplateTestContext = Object.fromEntries(
  testVariables.map((variable) => [variable.key, variable.value]),
);

export default function MailTemplatesPage() {
  const [templates, setTemplates] = useState<MailTemplate[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editorTab, setEditorTab] = useState<EditorTab>("html");
  const [message, setMessage] = useState<Notice | null>(null);
  const [testTo, setTestTo] = useState("owner@routlis.local");
  const [testSubject, setTestSubject] = useState("");
  const [testContext, setTestContext] = useState<Record<string, string>>(
    defaultTemplateTestContext,
  );

  async function load(nextSelectedKey?: string | null) {
    setLoading(true);
    try {
      const result = await api<MailTemplate[]>("/admin/mail/templates");
      setTemplates(result);
      const key = nextSelectedKey ?? selectedKey ?? result[0]?.key ?? null;
      if (key) {
        const current = result.find((template) => template.key === key);
        if (current) {
          selectTemplate(current);
        }
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

  function selectTemplate(template: MailTemplate) {
    setSelectedKey(template.key);
      setForm({
        key: template.key,
        name: template.name,
        description: template.description ?? "",
        subject: template.subject,
        htmlBody: stripCss(template.htmlBody),
        cssExtra: extractInlineCss(template.htmlBody),
        textBody: template.textBody ?? "",
        isActive: template.isActive,
      });
  }

  function startNew() {
    setSelectedKey(null);
    setForm({
      ...emptyForm,
      key: `CUSTOM_${Date.now()}`,
      name: "Nueva plantilla",
    });
    setEditorTab("html");
    setMessage({ tone: "info", text: "Crea una plantilla nueva o pega HTML/CSS directamente." });
  }

  function duplicateCurrent() {
    setSelectedKey(null);
    setForm((current) => ({
      ...current,
      key: `${current.key || "CUSTOM"}_COPY`,
      name: `${current.name || "Plantilla"} (copia)`,
    }));
    setMessage({ tone: "info", text: "Plantilla duplicada. Ajusta la clave antes de guardar." });
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        key: form.key.trim(),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        subject: form.subject.trim(),
        htmlBody: composeHtml(form.htmlBody, form.cssExtra),
        textBody: form.textBody.trim() || undefined,
        isActive: form.isActive,
      };
      if (!payload.key) throw new Error("La clave es obligatoria.");
      if (selectedKey) {
        await api(`/admin/mail/templates/${encodeURIComponent(selectedKey)}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await api("/admin/mail/templates", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setMessage({ tone: "success", text: "Plantilla guardada." });
      await load(payload.key);
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof ApiError ? error.message : (error as Error).message,
      });
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!selectedKey) return;
    if (!window.confirm(`Eliminar la plantilla "${selectedKey}"?`)) return;
    setDeleting(true);
    try {
      await api(`/admin/mail/templates/${encodeURIComponent(selectedKey)}`, { method: "DELETE" });
      setMessage({ tone: "success", text: "Plantilla eliminada." });
      setSelectedKey(null);
      setForm(emptyForm);
      await load(null);
    } finally {
      setDeleting(false);
    }
  }

  const filteredTemplates = useMemo(() => {
    const term = search.trim().toLowerCase();
    return templates.filter((template) => {
      const matchesSearch =
        !term ||
        [template.name, template.key, template.description ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(term);
      const matchesFilter =
        filter === "all" ||
        (filter === "active" && template.isActive) ||
        (filter === "inactive" && !template.isActive);
      return matchesSearch && matchesFilter;
    });
  }, [filter, search, templates]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.key === selectedKey) ?? null,
    [selectedKey, templates],
  );

  const previewHtmlSource = useMemo(() => {
    if (editorTab === "text") {
      return `<pre style="white-space:pre-wrap;font-family:inherit;margin:0;">${escapeHtml(form.textBody || "Sin versión de texto.")}</pre>`;
    }
    return buildPreviewHtml(composeHtml(form.htmlBody, form.cssExtra), testVariables);
  }, [editorTab, form.htmlBody, form.cssExtra, form.textBody]);

  const previewTextSource = useMemo(() => {
    const resolvedText = applyTemplateVariables(form.textBody.trim() || "Sin versión de texto.") || "Sin versión de texto.";
    return `<pre style="white-space:pre-wrap;font-family:inherit;margin:0;">${escapeHtml(resolvedText)}</pre>`;
  }, [form.textBody]);

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
          Nueva plantilla
        </button>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <TemplateListPanel
          loading={loading}
          templates={filteredTemplates}
          selectedKey={selectedKey}
          search={search}
          setSearch={setSearch}
          filter={filter}
          setFilter={setFilter}
          onSelect={selectTemplate}
          onInsertVariable={(token) => {
            if (editorTab === "text") {
              setForm((current) => ({ ...current, textBody: appendToken(current.textBody, token) }));
              return;
            }
            setForm((current) => ({ ...current, htmlBody: appendToken(current.htmlBody, token) }));
          }}
        />

        <TemplateEditorPanel
          selectedTemplate={selectedTemplate}
          form={form}
          setForm={setForm}
          saving={saving}
          deleting={deleting}
          onSave={onSave}
          onDelete={onDelete}
          onDuplicate={duplicateCurrent}
          editorTab={editorTab}
          setEditorTab={setEditorTab}
          previewHtmlSource={previewHtmlSource}
          previewTextSource={previewTextSource}
          testTo={testTo}
          setTestTo={setTestTo}
          testSubject={testSubject}
          setTestSubject={setTestSubject}
          testContext={testContext}
          setTestContext={setTestContext}
          onResetTestContext={() => setTestContext(defaultTemplateTestContext)}
          onInsertVariable={(token) => {
            if (editorTab === "text") {
              setForm((current) => ({ ...current, textBody: appendToken(current.textBody, token) }));
              return;
            }
            setForm((current) => ({ ...current, htmlBody: appendToken(current.htmlBody, token) }));
          }}
          onSendTest={async () => {
            try {
              await api("/admin/mail/templates/test", {
                method: "POST",
                body: JSON.stringify({
                  to: testTo,
                  subject: testSubject || `Prueba de ${form.name || form.key || "plantilla"}`,
                  htmlBody: applyTemplateVariables(composeHtml(form.htmlBody, form.cssExtra)),
                  textBody: applyTemplateVariables(form.textBody.trim() || undefined),
                  templateKey: form.key || undefined,
                  context: testContext,
                }),
              });
              setMessage({ tone: "success", text: `Prueba enviada correctamente a ${testTo}.` });
            } catch (error) {
              setMessage({
                tone: "error",
                text: error instanceof ApiError ? error.message : "No se pudo enviar la prueba.",
              });
            }
          }}
        />
      </div>

      {message && (
        <div
          className={`mt-5 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${
            message.tone === "success"
              ? "success-surface"
              : message.tone === "error"
                ? "danger-surface"
                : "border-outline-variant bg-surface-container text-on-surface"
          }`}
        >
          <div
            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
              message.tone === "success"
                ? "success-surface-strong"
                : message.tone === "error"
                  ? "danger-surface-strong"
                  : "bg-primary-container text-on-primary-container"
            }`}
          >
            {message.tone === "success" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : message.tone === "error" ? (
              <TriangleAlert className="h-4 w-4" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
          </div>
          <p className="min-w-0 flex-1 font-medium">{message.text}</p>
        </div>
      )}
    </MailModuleShell>
  );
}

function TemplateListPanel({
  loading,
  templates,
  selectedKey,
  search,
  setSearch,
  filter,
  setFilter,
  onSelect,
  onInsertVariable,
}: {
  loading: boolean;
  templates: MailTemplate[];
  selectedKey: string | null;
  search: string;
  setSearch: (value: string) => void;
  filter: Filter;
  setFilter: (value: Filter) => void;
  onSelect: (template: MailTemplate) => void;
  onInsertVariable: (token: string) => void;
}) {
  return (
    <aside className="rounded-[28px] border border-outline-variant bg-surface-container p-4 shadow-elevation-1">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-on-surface">Plantillas</h2>
          <p className="text-sm text-on-surface-variant">Catálogo transaccional.</p>
        </div>
      </div>

      <label className="mb-3 flex items-center gap-2 rounded-2xl border border-outline-variant bg-surface-container-high px-3 py-2.5">
        <Search className="h-4 w-4 text-on-surface-variant" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar plantilla"
          className="w-full bg-transparent text-sm outline-none placeholder:text-on-surface-variant"
        />
      </label>

      <div className="mb-3 flex flex-wrap gap-2">
        {[
          { key: "all", label: "Todas" },
          { key: "active", label: "Activas" },
          { key: "inactive", label: "Inactivas" },
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

      <div className="max-h-[68vh] space-y-2 overflow-auto pr-1">
        {loading ? (
          <div className="rounded-2xl border border-outline-variant bg-surface-container-high px-4 py-10 text-center text-sm text-on-surface-variant">
            Cargando plantillas...
          </div>
        ) : templates.length === 0 ? (
          <div className="rounded-2xl border border-outline-variant bg-surface-container-high px-4 py-10 text-center text-sm text-on-surface-variant">
            No hay plantillas que coincidan.
          </div>
        ) : (
          templates.map((template) => {
            const active = template.key === selectedKey;
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => onSelect(template)}
                className={`w-full rounded-2xl border p-3 text-left transition ${
                  active
                    ? "border-primary bg-primary/10 shadow-elevation-1"
                    : "border-outline-variant bg-surface-container-high hover:border-primary/40 hover:bg-primary/5"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-on-surface">{template.name}</p>
                    <p className="truncate text-[11px] uppercase tracking-[0.18em] text-on-surface-variant">
                      {template.key}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                      template.isActive ? "success-surface" : "bg-outline-variant/30 text-on-surface-variant"
                    }`}
                  >
                    {template.isActive ? "Activa" : "Inactiva"}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-on-surface-variant">
                  {template.description ?? "Sin descripción"}
                </p>
              </button>
            );
          })
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-outline-variant bg-surface-container-high p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-on-surface-variant">
          Variables
        </p>
        <p className="mt-1 text-xs text-on-surface-variant">
          Haz clic para insertar en el campo activo.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {variableChips.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => onInsertVariable(chip)}
              className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-3 py-2 text-xs text-on-surface-variant transition hover:border-primary hover:text-on-surface"
            >
              <Copy className="h-3.5 w-3.5" />
              {chip}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}

function TemplateEditorPanel({
  selectedTemplate,
  form,
  setForm,
  saving,
  deleting,
  onSave,
  onDelete,
  onDuplicate,
  editorTab,
  setEditorTab,
  previewHtmlSource,
  previewTextSource,
  testTo,
  setTestTo,
  testSubject,
  setTestSubject,
  testContext,
  setTestContext,
  onResetTestContext,
  onInsertVariable,
  onSendTest,
}: {
  selectedTemplate: MailTemplate | null;
  form: TemplateForm;
  setForm: React.Dispatch<React.SetStateAction<TemplateForm>>;
  saving: boolean;
  deleting: boolean;
  onSave: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onDelete: () => Promise<void>;
  onDuplicate: () => void;
  editorTab: EditorTab;
  setEditorTab: (value: EditorTab) => void;
  previewHtmlSource: string;
  previewTextSource: string;
  testTo: string;
  setTestTo: (value: string) => void;
  testSubject: string;
  setTestSubject: (value: string) => void;
  testContext: Record<string, string>;
  setTestContext: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onResetTestContext: () => void;
  onInsertVariable: (token: string) => void;
  onSendTest: () => void;
}) {
  return (
    <section className="space-y-4">
      <form onSubmit={onSave} className="space-y-4">
        <div className="rounded-[28px] border border-outline-variant bg-surface-container p-5 shadow-elevation-1">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="truncate text-xl font-semibold text-on-surface">
                {selectedTemplate?.name || form.name || "Nueva plantilla"}
              </h2>
              <p className="mt-1 truncate text-sm text-on-surface-variant">
                {selectedTemplate?.key || form.key || "Sin clave"}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                form.isActive ? "success-surface" : "bg-outline-variant/30 text-on-surface-variant"
              }`}
            >
              {form.isActive ? "Activa" : "Inactiva"}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary shadow-elevation-1 transition hover:opacity-90 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? "Guardando..." : "Guardar plantilla"}
            </button>
            <button
              type="button"
              onClick={onDuplicate}
              className="inline-flex items-center gap-2 rounded-full border border-outline-variant px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:border-primary hover:text-on-surface"
            >
              <Copy className="h-4 w-4" />
              Duplicar
            </button>
            <button
              type="button"
              onClick={onSendTest}
              className="inline-flex items-center gap-2 rounded-full border border-primary px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/10"
            >
              <Send className="h-4 w-4" />
              Enviar prueba
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting || !selectedTemplate}
              className="inline-flex items-center gap-2 rounded-full border border-error px-4 py-2.5 text-sm font-semibold text-error transition disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? "Eliminando..." : "Eliminar"}
            </button>
          </div>
        </div>

        <div className="rounded-[28px] border border-outline-variant bg-surface-container p-5 shadow-elevation-1">
          <h3 className="text-lg font-semibold text-on-surface">Datos básicos</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Nombre">
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className={inputClass}
              />
            </Field>
            <Field label="Clave">
              <input
                value={form.key}
                onChange={(event) => setForm((current) => ({ ...current, key: event.target.value }))}
                className={inputClass}
                disabled={Boolean(selectedTemplate)}
              />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Asunto">
              <input
                value={form.subject}
                onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
                className={inputClass}
              />
            </Field>
          </div>
          <div className="mt-4 grid gap-4">
            <Field label="Descripción">
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                className={`${inputClass} min-h-[84px]`}
              />
            </Field>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Estado">
              <select
                value={String(form.isActive)}
                onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.value === "true" }))}
                className={inputClass}
              >
                <option value="true">Activa</option>
                <option value="false">Inactiva</option>
              </select>
            </Field>
            <Field label="Texto plano">
              <select
                value={form.textBody ? "yes" : "no"}
                onChange={(event) =>
                  setForm((current) => ({ ...current, textBody: event.target.value === "yes" ? current.textBody : "" }))
                }
                className={inputClass}
              >
                <option value="yes">Incluido</option>
                <option value="no">Vacío</option>
              </select>
            </Field>
          </div>
        </div>
      </form>

      <div className="rounded-[28px] border border-outline-variant bg-surface-container p-5 shadow-elevation-1">
        <div className="mb-4 flex flex-wrap gap-2">
          {[
            { key: "html", label: "HTML" },
            { key: "text", label: "Texto" },
            { key: "variables", label: "Variables" },
            { key: "preview", label: "Vista previa" },
            { key: "test", label: "Prueba" },
          ].map((tab) => {
            const active = editorTab === (tab.key as EditorTab);
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setEditorTab(tab.key as EditorTab)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  active
                    ? "border-primary bg-primary text-on-primary"
                    : "border-outline-variant bg-surface-container-high text-on-surface-variant hover:border-primary hover:text-on-surface"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {editorTab === "html" && (
          <div className="space-y-4">
            <Field label="HTML">
              <textarea
                value={form.htmlBody}
                onChange={(event) =>
                  setForm((current) => ({ ...current, htmlBody: event.target.value }))
                }
                className="min-h-[320px] w-full rounded-[24px] border border-outline-variant bg-surface-container-high px-4 py-3 font-mono text-sm text-on-surface outline-none focus:border-primary"
              />
            </Field>
            <Field label="CSS extra">
              <textarea
                value={form.cssExtra}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    cssExtra: event.target.value,
                  }))
                }
                className="min-h-[160px] w-full rounded-[24px] border border-outline-variant bg-surface-container-high px-4 py-3 font-mono text-sm text-on-surface outline-none focus:border-primary"
                placeholder="body { background: #f6f0ff; }"
              />
            </Field>
          </div>
        )}

        {editorTab === "text" && (
          <div className="space-y-3">
            <Field label="Texto plano">
              <textarea
                value={form.textBody}
                onChange={(event) => setForm((current) => ({ ...current, textBody: event.target.value }))}
                className="min-h-[320px] w-full rounded-[24px] border border-outline-variant bg-surface-container-high px-4 py-3 font-mono text-sm text-on-surface outline-none focus:border-primary"
              />
            </Field>
            <p className="text-sm text-on-surface-variant">
              Esta versión se usará cuando el cliente de correo no soporte HTML.
            </p>
          </div>
        )}

        {editorTab === "variables" && (
          <div className="space-y-4">
            <p className="text-sm text-on-surface-variant">
              Inserta o copia variables disponibles para usar en la plantilla. Al hacer clic se pegan en el contenido activo.
            </p>
            <div className="flex flex-wrap gap-2">
              {variableChips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={async () => {
                    onInsertVariable(chip);
                    await navigator.clipboard.writeText(chip);
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container-high px-3 py-2 text-sm text-on-surface-variant transition hover:border-primary hover:text-on-surface"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {editorTab === "preview" && (
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="overflow-hidden rounded-[24px] border border-outline-variant bg-white">
              <div className="border-b border-outline-variant bg-surface-container-high px-4 py-3">
                <h4 className="text-sm font-semibold text-on-surface">Vista HTML</h4>
              </div>
              {previewHtmlSource ? (
                <iframe
                  title="preview-html"
                  className="h-[420px] w-full bg-white"
                  sandbox=""
                  srcDoc={previewHtmlSource}
                />
              ) : (
                <div className="flex h-[220px] items-center justify-center text-sm text-on-surface-variant">
                  Vista previa HTML pendiente de conexión.
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-[24px] border border-outline-variant bg-white">
              <div className="border-b border-outline-variant bg-surface-container-high px-4 py-3">
                <h4 className="text-sm font-semibold text-on-surface">Texto plano</h4>
              </div>
              {previewTextSource ? (
                <iframe
                  title="preview-text"
                  className="h-[420px] w-full bg-white"
                  sandbox=""
                  srcDoc={previewTextSource}
                />
              ) : (
                <div className="flex h-[220px] items-center justify-center text-sm text-on-surface-variant">
                  Vista previa de texto plano pendiente de conexión.
                </div>
              )}
            </div>
          </div>
        )}

        {editorTab === "test" && (
          <TemplateTestPanel
            testTo={testTo}
            setTestTo={setTestTo}
            testSubject={testSubject}
            setTestSubject={setTestSubject}
            testContext={testContext}
            setTestContext={setTestContext}
            onResetTestContext={onResetTestContext}
            onSendTest={onSendTest}
          />
        )}
      </div>
    </section>
  );
}

function TemplateTestPanel({
  testTo,
  setTestTo,
  testSubject,
  setTestSubject,
  testContext,
  setTestContext,
  onResetTestContext,
  onSendTest,
}: {
  testTo: string;
  setTestTo: (value: string) => void;
  testSubject: string;
  setTestSubject: (value: string) => void;
  testContext: Record<string, string>;
  setTestContext: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onResetTestContext: () => void;
  onSendTest: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
        <Field label="Enviar a">
          <input value={testTo} onChange={(e) => setTestTo(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Asunto opcional">
          <input value={testSubject} onChange={(e) => setTestSubject(e.target.value)} className={inputClass} />
        </Field>
        <div className="flex items-end">
          <button
            type="button"
            onClick={onSendTest}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-primary px-4 text-sm font-semibold text-primary transition hover:bg-primary/10"
          >
            <Mail className="h-4 w-4" />
            Enviar prueba
          </button>
        </div>
      </div>

      <div className="rounded-[24px] border border-outline-variant bg-surface-container-high p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-on-surface">Contexto manual</h4>
            <p className="text-xs text-on-surface-variant">
              Ajusta los valores usados para resolver variables antes de enviar la plantilla.
            </p>
          </div>
          <button
            type="button"
            onClick={onResetTestContext}
            className="rounded-full border border-outline-variant px-3 py-1.5 text-xs font-semibold text-on-surface-variant transition hover:border-primary hover:text-on-surface"
          >
            Restaurar ejemplo
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {testVariables.map((variable) => (
            <Field key={variable.key} label={variable.key}>
              <input
                value={testContext[variable.key] ?? ""}
                onChange={(event) =>
                  setTestContext((current) => ({
                    ...current,
                    [variable.key]: event.target.value,
                  }))
                }
                className={inputClass}
              />
            </Field>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="text-xs font-semibold uppercase tracking-[0.22em] text-on-surface-variant">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "h-10 w-full rounded-xl border border-outline-variant bg-surface-container-high px-3 text-sm text-on-surface outline-none focus:border-primary";

function escapeHtml(input: string) {
  return input.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function extractInlineCss(html: string) {
  const match = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  return match?.[1]?.trim() ?? "";
}

function stripCss(html: string) {
  return html.replace(/<style[^>]*>[\s\S]*?<\/style>/i, "").trim();
}

function composeHtml(html: string, css: string) {
  const cleanHtml = stripCss(html);
  const styleTag = css.trim() ? `<style>\n${css.trim()}\n</style>` : "";
  if (!styleTag) return cleanHtml;
  if (cleanHtml.includes("</head>")) {
    return cleanHtml.replace("</head>", `${styleTag}\n</head>`);
  }
  return `${styleTag}\n${cleanHtml}`;
}

function appendToken(value: string, token: string) {
  return value.trim().length ? `${value} ${token}` : token;
}

function applyTemplateVariables(input?: string) {
  if (!input) return input;
  return testVariables.reduce(
    (acc, variable) => acc.replaceAll(`{{${variable.key}}}`, variable.value),
    input,
  );
}

function buildPreviewHtml(html: string, variables: Array<{ key: string; value: string }>) {
  const resolvedHtml =
    variables.reduce(
      (acc, variable) => acc.replaceAll(`{{${variable.key}}}`, variable.value),
      html,
    ) || "<div style=\"padding:24px;font-family:Arial,sans-serif;\">Vista previa pendiente de conexión.</div>";
  if (resolvedHtml.includes("<html")) return resolvedHtml;
  return `<!doctype html><html><head><meta charset="utf-8"></head><body>${resolvedHtml}</body></html>`;
}
