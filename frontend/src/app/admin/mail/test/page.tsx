"use client";

import { useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import { api, ApiError } from "@/lib/api";

const inputClass = "h-11 w-full rounded-xl border border-outline-variant bg-surface-container-high px-3 text-sm text-on-surface outline-none focus:border-primary";

export default function MailTestPage() {
  const [to, setTo] = useState("owner@routlis.local");
  const [subject, setSubject] = useState("Prueba de correo Routlis");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    try {
      await api("/admin/mail/test", {
        method: "POST",
        body: JSON.stringify({ to, subject, message }),
      });
      setResult("Correo de prueba enviado.");
    } catch (error) {
      setResult(error instanceof ApiError ? error.message : "No se pudo enviar la prueba.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-[28px] border border-outline-variant bg-surface-container p-4 shadow-elevation-1 sm:p-5">
        <h2 className="text-xl font-semibold text-on-surface">Pruebas de correo</h2>
        <p className="mt-1 text-sm text-on-surface-variant">Envía correos de prueba para verificar la configuración SMTP.</p>
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <Field label="Enviar a"><input type="email" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} /></Field>
          <Field label="Asunto"><input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass} /></Field>
          <Field label="Mensaje opcional"><textarea value={message} onChange={(e) => setMessage(e.target.value)} className={`${inputClass} min-h-[120px]`} /></Field>
          <button type="submit" disabled={sending} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary shadow-elevation-1 transition hover:opacity-90 disabled:opacity-60 sm:w-auto">
            <Send className="h-4 w-4" />
            {sending ? "Enviando..." : "Enviar prueba"}
          </button>
        </form>
      </section>

      <section className="rounded-[28px] border border-outline-variant bg-surface-container p-4 shadow-elevation-1 sm:p-5">
        <h2 className="text-xl font-semibold text-on-surface">Resultado</h2>
        <p className="mt-1 text-sm text-on-surface-variant">Última respuesta del envío.</p>
        <div className="mt-4 rounded-2xl border border-outline-variant bg-surface-container-high p-4 text-sm text-on-surface-variant">
          {result ?? "Sin intentos todavía."}
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="space-y-2"><span className="text-xs font-semibold uppercase tracking-[0.24em] text-on-surface-variant">{label}</span>{children}</label>;
}
