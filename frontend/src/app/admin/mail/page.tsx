"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Mail, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { AdminProtectedPage } from "@/components/layout/AdminProtectedPage";
import { PageHeader } from "@/components/ui/PageHeader";
import { ApiError, api } from "@/lib/api";

type MailSettings = {
  id: string;
  provider: string;
  enabled: boolean;
  fromName: string;
  fromEmail: string;
  replyTo: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUser: string | null;
  smtpPasswordLast4: string | null;
  lastTestAt: string | null;
  lastTestMessage: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

type MailLog = {
  id: string;
  type: string;
  to: string;
  subject: string;
  status: string;
  providerMessageId?: string | null;
  errorMessage: string | null;
  contextJson?: {
    acceptedRecipients?: string[];
    rejectedRecipients?: string[];
    responseMessage?: string | null;
    [key: string]: unknown;
  } | null;
  createdAt: string;
};

type DisplayMailLog = MailLog & {
  note?: string;
};

const defaultForm = {
  provider: "smtp",
  enabled: false,
  fromName: "Routlis",
  fromEmail: "notificaciones@routlis.com",
  replyTo: "",
  smtpHost: "",
  smtpPort: "465",
  smtpSecure: true,
  smtpUser: "",
  smtpPassword: "",
};

export default function AdminMailPage() {
  const [settings, setSettings] = useState<MailSettings | null>(null);
  const [logs, setLogs] = useState<MailLog[]>([]);
  const [localLogs, setLocalLogs] = useState<DisplayMailLog[]>([]);
  const [form, setForm] = useState(defaultForm);
  const [testTo, setTestTo] = useState("owner@routlis.local");
  const [testSubject, setTestSubject] = useState("Prueba de correo Routlis");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [settingsResult, logsResult] = await Promise.all([
        api<MailSettings>("/admin/mail/settings"),
        api<MailLog[]>("/admin/mail/logs"),
      ]);
      setSettings(settingsResult);
      setLogs(logsResult);
      setForm({
        provider: settingsResult.provider ?? "smtp",
        enabled: settingsResult.enabled,
        fromName: settingsResult.fromName,
        fromEmail: settingsResult.fromEmail,
        replyTo: settingsResult.replyTo ?? "",
        smtpHost: settingsResult.smtpHost ?? "",
        smtpPort: String(settingsResult.smtpPort ?? 465),
        smtpSecure: settingsResult.smtpSecure,
        smtpUser: settingsResult.smtpUser ?? "",
        smtpPassword: "",
      });
      setMessage(settingsResult.lastTestMessage ?? null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await api("/admin/mail/settings", {
        method: "PUT",
        body: JSON.stringify({
          provider: form.provider,
          enabled: form.enabled,
          fromName: form.fromName,
          fromEmail: form.fromEmail,
          replyTo: form.replyTo || undefined,
          smtpHost: form.smtpHost || undefined,
          smtpPort: form.smtpPort ? Number(form.smtpPort) : undefined,
          smtpSecure: form.smtpSecure,
          smtpUser: form.smtpUser || undefined,
          smtpPassword: form.smtpPassword || undefined,
        }),
      });
      setForm((current) => ({ ...current, smtpPassword: "" }));
      setMessage("Configuración guardada.");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function sendTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTesting(true);
    setMessage(null);
    try {
      await api("/admin/mail/test", {
        method: "POST",
        body: JSON.stringify({
          to: testTo,
          subject: testSubject,
        }),
      });
      setMessage("Correo de prueba enviado.");
      setLocalLogs((current) => [
        {
          id: `local-${Date.now()}`,
          type: "TEST",
          to: testTo,
          subject: testSubject,
          status: "SENT",
          errorMessage: null,
          createdAt: new Date().toISOString(),
          note: "Enviado correctamente desde el panel.",
        },
        ...current,
      ]);
      await load();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        const note = "No autorizado: no se envió el correo.";
        setMessage(note);
        setLocalLogs((current) => [
          {
            id: `local-${Date.now()}`,
            type: "TEST",
            to: testTo,
            subject: testSubject,
            status: "UNAUTHORIZED",
            errorMessage: note,
            createdAt: new Date().toISOString(),
            note,
          },
          ...current,
        ]);
        return;
      }

      const note = "No se pudo enviar el correo. No salió del backend.";
      setMessage(note);
      setLocalLogs((current) => [
        {
          id: `local-${Date.now()}`,
          type: "TEST",
          to: testTo,
          subject: testSubject,
          status: "FAILED",
          errorMessage: note,
          createdAt: new Date().toISOString(),
          note,
        },
        ...current,
      ]);
    } finally {
      setTesting(false);
    }
  }

  const displayLogs = useMemo(
    () => [...localLogs, ...logs].slice(0, 30),
    [localLogs, logs],
  );

  function statusLabel(status: string) {
    if (status === "SENT") return "Enviado";
    if (status === "FAILED") return "Falló";
    if (status === "UNAUTHORIZED") return "No autorizado";
    return status;
  }

  function statusClass(status: string) {
    if (status === "SENT") return "bg-emerald-500/15 text-emerald-400";
    if (status === "UNAUTHORIZED") return "bg-amber-500/15 text-amber-400";
    return "bg-error/10 text-error";
  }

  function interpretMailLog(log: DisplayMailLog) {
    if (log.status === "UNAUTHORIZED") {
      return {
        title: "No autorizado",
        description: "El panel no pudo ejecutar el envío, por lo tanto el correo no salió del backend.",
        hint: "Revisa la sesión del usuario y vuelve a intentarlo.",
      };
    }

    if (log.status === "FAILED") {
      return {
        title: "Falló el envío",
        description: "El backend intentó enviar el correo, pero SMTP respondió con error.",
        hint: log.errorMessage ?? "Revisa la configuración SMTP.",
      };
    }

    const accepted = log.contextJson?.acceptedRecipients ?? [];
    const rejected = log.contextJson?.rejectedRecipients ?? [];
    if (log.status === "SENT") {
      if (accepted.length > 0 && rejected.length === 0) {
        return {
          title: "Aceptado por SMTP",
          description: "Gmail aceptó el mensaje. Si no aparece, revisa spam, promociones o filtros del receptor.",
          hint: log.contextJson?.responseMessage ?? "Entrega pendiente de la red de correo.",
        };
      }

      if (accepted.length > 0 && rejected.length > 0) {
        return {
          title: "Aceptación parcial",
          description: "Parte del envío fue aceptado por SMTP y parte fue rechazado.",
          hint: `Aceptados: ${accepted.join(", ")} · Rechazados: ${rejected.join(", ")}`,
        };
      }
    }

    return {
      title: "Estado técnico",
      description: "El backend respondió con éxito, pero todavía conviene revisar el inbox y el spam.",
      hint: log.contextJson?.responseMessage ?? "Sin respuesta SMTP adicional.",
    };
  }

  return (
    <AdminProtectedPage>
      <div className="space-y-6">
        <PageHeader
          title="Correo"
          description="Configuración SMTP global, pruebas y registros básicos. Solo OWNER."
          action={
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 rounded-full border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface transition hover:border-primary"
            >
              <RefreshCw className="h-4 w-4" />
              Recargar
            </button>
          }
        />

        {message && (
          <div className="rounded-2xl border border-outline-variant bg-surface-container px-4 py-3 text-sm text-on-surface">
            {message}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
          <section className="rounded-[28px] border border-outline-variant bg-surface-container p-5 shadow-elevation-1">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-on-surface">Ajustes SMTP</h2>
                <p className="text-sm text-on-surface-variant">Proveedor global del sistema.</p>
              </div>
            </div>

            <form onSubmit={saveSettings} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">From name</span>
                  <input
                    value={form.fromName}
                    onChange={(event) => setForm((current) => ({ ...current, fromName: event.target.value }))}
                    className="h-11 w-full rounded-xl border border-outline-variant bg-surface-container-high px-3 text-sm text-on-surface outline-none focus:border-primary"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">From email</span>
                  <input
                    type="email"
                    value={form.fromEmail}
                    onChange={(event) => setForm((current) => ({ ...current, fromEmail: event.target.value }))}
                    className="h-11 w-full rounded-xl border border-outline-variant bg-surface-container-high px-3 text-sm text-on-surface outline-none focus:border-primary"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">SMTP host</span>
                  <input
                    value={form.smtpHost}
                    onChange={(event) => setForm((current) => ({ ...current, smtpHost: event.target.value }))}
                    className="h-11 w-full rounded-xl border border-outline-variant bg-surface-container-high px-3 text-sm text-on-surface outline-none focus:border-primary"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">SMTP port</span>
                  <input
                    value={form.smtpPort}
                    onChange={(event) => setForm((current) => ({ ...current, smtpPort: event.target.value }))}
                    className="h-11 w-full rounded-xl border border-outline-variant bg-surface-container-high px-3 text-sm text-on-surface outline-none focus:border-primary"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">SMTP user</span>
                  <input
                    value={form.smtpUser}
                    onChange={(event) => setForm((current) => ({ ...current, smtpUser: event.target.value }))}
                    className="h-11 w-full rounded-xl border border-outline-variant bg-surface-container-high px-3 text-sm text-on-surface outline-none focus:border-primary"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">SMTP password</span>
                  <input
                    type="password"
                    value={form.smtpPassword}
                    onChange={(event) => setForm((current) => ({ ...current, smtpPassword: event.target.value }))}
                    placeholder="Dejar vacío para conservar"
                    className="h-11 w-full rounded-xl border border-outline-variant bg-surface-container-high px-3 text-sm text-on-surface outline-none focus:border-primary"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">Reply-to</span>
                  <input
                    type="email"
                    value={form.replyTo}
                    onChange={(event) => setForm((current) => ({ ...current, replyTo: event.target.value }))}
                    className="h-11 w-full rounded-xl border border-outline-variant bg-surface-container-high px-3 text-sm text-on-surface outline-none focus:border-primary"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">Secure</span>
                  <select
                    value={String(form.smtpSecure)}
                    onChange={(event) => setForm((current) => ({ ...current, smtpSecure: event.target.value === "true" }))}
                    className="h-11 w-full rounded-xl border border-outline-variant bg-surface-container-high px-3 text-sm text-on-surface outline-none focus:border-primary"
                  >
                    <option value="true">Sí</option>
                    <option value="false">No</option>
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">Activo</span>
                  <select
                    value={String(form.enabled)}
                    onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.value === "true" }))}
                    className="h-11 w-full rounded-xl border border-outline-variant bg-surface-container-high px-3 text-sm text-on-surface outline-none focus:border-primary"
                  >
                    <option value="true">Sí</option>
                    <option value="false">No</option>
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition hover:opacity-90 disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {saving ? "Guardando..." : "Guardar configuración"}
                </button>
                <span className="inline-flex items-center gap-2 rounded-full border border-outline-variant px-4 py-2.5 text-sm text-on-surface-variant">
                  <Mail className="h-4 w-4" />
                  Última prueba: {settings?.lastTestAt ? new Date(settings.lastTestAt).toLocaleString() : "sin pruebas"}
                </span>
              </div>
            </form>
          </section>

          <div className="space-y-6">
            <section className="rounded-[28px] border border-outline-variant bg-surface-container p-5 shadow-elevation-1">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  <Send className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-on-surface">Correo de prueba</h2>
                  <p className="text-sm text-on-surface-variant">Verifica el envío sin salir del panel.</p>
                </div>
              </div>
              <form onSubmit={sendTest} className="space-y-4">
                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">Enviar a</span>
                  <input
                    type="email"
                    value={testTo}
                    onChange={(event) => setTestTo(event.target.value)}
                    className="h-11 w-full rounded-xl border border-outline-variant bg-surface-container-high px-3 text-sm text-on-surface outline-none focus:border-primary"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">Asunto</span>
                  <input
                    value={testSubject}
                    onChange={(event) => setTestSubject(event.target.value)}
                    className="h-11 w-full rounded-xl border border-outline-variant bg-surface-container-high px-3 text-sm text-on-surface outline-none focus:border-primary"
                  />
                </label>
                <button
                  type="submit"
                  disabled={testing}
                  className="inline-flex items-center gap-2 rounded-full border border-primary px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/10 disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                  {testing ? "Enviando..." : "Enviar prueba"}
                </button>
              </form>
            </section>

            <section className="rounded-[28px] border border-outline-variant bg-surface-container p-5 shadow-elevation-1">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-on-surface">Logs recientes</h2>
                  <p className="text-sm text-on-surface-variant">Éxitos y fallos básicos.</p>
                </div>
                  <span className="rounded-full border border-outline-variant px-3 py-1 text-xs text-on-surface-variant">
                    {displayLogs.length} eventos
                  </span>
                </div>

              {loading ? (
                <div className="rounded-2xl border border-outline-variant bg-surface-container-high py-12 text-center text-sm text-on-surface-variant">
                  Cargando registros...
                </div>
              ) : displayLogs.length === 0 ? (
                <div className="rounded-2xl border border-outline-variant bg-surface-container-high py-12 text-center text-sm text-on-surface-variant">
                  Todavía no hay eventos de correo.
                </div>
              ) : (
                <div className="max-h-[420px] overflow-auto pr-1">
                  <div className="space-y-3">
                    {displayLogs.map((log: DisplayMailLog) => (
                      <div
                        key={log.id}
                        className="rounded-2xl border border-outline-variant bg-surface-container-high px-4 py-3"
                      >
                        {(() => {
                          const interpreted = interpretMailLog(log);
                          return (
                            <div className="mb-3 rounded-xl border border-outline-variant bg-surface-container px-3 py-2">
                              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">
                                {interpreted.title}
                              </p>
                              <p className="mt-1 text-sm text-on-surface">
                                {interpreted.description}
                              </p>
                              <p className="mt-1 text-xs text-on-surface-variant">
                                {interpreted.hint}
                              </p>
                            </div>
                          );
                        })()}
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-on-surface">{log.subject}</p>
                            <p className="text-xs text-on-surface-variant">{log.to}</p>
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass(log.status)}`}>
                            {statusLabel(log.status)}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-on-surface-variant">
                          {log.type} · {new Date(log.createdAt).toLocaleString()}
                        </p>
                        {log.providerMessageId && (
                          <p className="mt-1 text-[11px] text-on-surface-variant">
                            Message ID: {log.providerMessageId}
                          </p>
                        )}
                        {(log.note || log.errorMessage) && (
                          <p className={`mt-1 text-xs ${log.status === "SENT" ? "text-emerald-400" : "text-on-surface-variant"}`}>
                            {log.note ?? log.errorMessage}
                          </p>
                        )}
                        {log.contextJson && (
                          <div className="mt-2 rounded-xl border border-outline-variant bg-surface-container px-3 py-2 text-[11px] text-on-surface-variant">
                            <p>
                              Aceptados: {log.contextJson.acceptedRecipients?.length ? log.contextJson.acceptedRecipients.join(", ") : "ninguno"}
                            </p>
                            <p>
                              Rechazados: {log.contextJson.rejectedRecipients?.length ? log.contextJson.rejectedRecipients.join(", ") : "ninguno"}
                            </p>
                            {log.contextJson.responseMessage && (
                              <p className="mt-1">Respuesta SMTP: {String(log.contextJson.responseMessage)}</p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </AdminProtectedPage>
  );
}
