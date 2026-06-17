"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Mail, ShieldCheck, Send } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { MailSettings, MailLog } from "@/types/mail";

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

export default function MailSmtpPage() {
  const [settings, setSettings] = useState<MailSettings | null>(null);
  const [logs, setLogs] = useState<MailLog[]>([]);
  const [form, setForm] = useState(defaultForm);
  const [testTo, setTestTo] = useState("owner@routlis.local");
  const [testSubject, setTestSubject] = useState("Prueba de correo Routlis");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(true);

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
    try {
      await api("/admin/mail/test", {
        method: "POST",
        body: JSON.stringify({
          to: testTo,
          subject: testSubject,
          message: message ?? "",
        }),
      });
      setMessage("Correo de prueba enviado.");
      await load();
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "No se pudo enviar el correo.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
      <section className="rounded-[28px] border border-outline-variant bg-surface-container p-5 shadow-elevation-1">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-on-surface">SMTP</h2>
            <p className="text-sm text-on-surface-variant">Configura el proveedor global de envío de correos de Routlis.</p>
          </div>
        </div>
        <form onSubmit={saveSettings} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="From name"><input value={form.fromName} onChange={(e) => setForm((c) => ({ ...c, fromName: e.target.value }))} className={inputClass} /></Field>
            <Field label="From email"><input type="email" value={form.fromEmail} onChange={(e) => setForm((c) => ({ ...c, fromEmail: e.target.value }))} className={inputClass} /></Field>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="SMTP host"><input value={form.smtpHost} onChange={(e) => setForm((c) => ({ ...c, smtpHost: e.target.value }))} className={inputClass} /></Field>
            <Field label="SMTP port"><input value={form.smtpPort} onChange={(e) => setForm((c) => ({ ...c, smtpPort: e.target.value }))} className={inputClass} /></Field>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="SMTP user"><input value={form.smtpUser} onChange={(e) => setForm((c) => ({ ...c, smtpUser: e.target.value }))} className={inputClass} /></Field>
            <Field label="SMTP password"><input type="password" value={form.smtpPassword} onChange={(e) => setForm((c) => ({ ...c, smtpPassword: e.target.value }))} placeholder="Dejar vacío para conservar" className={inputClass} /></Field>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Reply-to"><input type="email" value={form.replyTo} onChange={(e) => setForm((c) => ({ ...c, replyTo: e.target.value }))} className={inputClass} /></Field>
            <Field label="Secure"><select value={String(form.smtpSecure)} onChange={(e) => setForm((c) => ({ ...c, smtpSecure: e.target.value === "true" }))} className={inputClass}><option value="true">Sí</option><option value="false">No</option></select></Field>
            <Field label="Activo"><select value={String(form.enabled)} onChange={(e) => setForm((c) => ({ ...c, enabled: e.target.value === "true" }))} className={inputClass}><option value="true">Sí</option><option value="false">No</option></select></Field>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary shadow-elevation-1 transition hover:opacity-90 disabled:opacity-60">
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
            <Field label="Enviar a"><input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} className={inputClass} /></Field>
            <Field label="Asunto"><input value={testSubject} onChange={(e) => setTestSubject(e.target.value)} className={inputClass} /></Field>
            <Field label="Mensaje opcional"><textarea value={message ?? ""} onChange={(e) => setMessage(e.target.value)} className={`${inputClass} min-h-[96px]`} /></Field>
            <button type="submit" disabled={testing} className="inline-flex items-center gap-2 rounded-full border border-primary px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/10 disabled:opacity-60">
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
            <span className="rounded-full border border-outline-variant px-3 py-1 text-xs text-on-surface-variant">{logs.length} eventos</span>
          </div>
          {loading ? <div className="rounded-2xl border border-outline-variant bg-surface-container-high py-12 text-center text-sm text-on-surface-variant">Cargando registros...</div> :
            logs.length === 0 ? <div className="rounded-2xl border border-outline-variant bg-surface-container-high py-12 text-center text-sm text-on-surface-variant">Todavía no hay eventos de correo.</div> :
            <div className="max-h-[420px] overflow-auto pr-1 space-y-3">
              {logs.map((log) => (
                <div key={log.id} className="rounded-2xl border border-outline-variant bg-surface-container-high px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="font-medium text-on-surface">{log.subject}</p><p className="text-xs text-on-surface-variant">{log.to}</p></div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${log.status === "SENT" ? "success-surface" : "bg-error/10 text-error"}`}>{log.status}</span>
                  </div>
                  <p className="mt-2 text-xs text-on-surface-variant">{log.type} · {new Date(log.createdAt).toLocaleString()}</p>
                  {log.errorMessage && <p className="mt-1 text-xs text-on-surface-variant">{log.errorMessage}</p>}
                  {log.contextJson?.responseMessage && <p className="mt-1 text-[11px] text-on-surface-variant">Respuesta SMTP: {String(log.contextJson.responseMessage)}</p>}
                </div>
              ))}
            </div>}
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="space-y-2"><span className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">{label}</span>{children}</label>;
}

const inputClass = "h-11 w-full rounded-xl border border-outline-variant bg-surface-container-high px-3 text-sm text-on-surface outline-none focus:border-primary";
