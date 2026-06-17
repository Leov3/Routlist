"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { ThemeToggleButton } from "@/components/layout/ThemeToggleButton";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      await api("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setMessage("Si el correo existe, recibirás un enlace temporal para restablecer tu contraseña.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo enviar la solicitud.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-surface px-4 py-10 text-on-surface">
      <ThemeToggleButton behavior="binary" className="fixed right-4 top-4 z-20" />
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center">
        <form className="surface-panel w-full rounded-[28px] p-6" onSubmit={handleSubmit}>
          <p className="text-xs uppercase tracking-[0.22em] text-on-surface-variant">Recuperación</p>
          <h1 className="mt-2 text-3xl font-semibold">Olvidé mi contraseña</h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            Te enviaremos un enlace temporal si el correo está registrado.
          </p>

          <label className="mt-6 block text-sm font-medium text-on-surface">Email</label>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            required
            placeholder="tu@correo.com"
            className="input-surface mt-2 h-12 w-full rounded-2xl px-4 text-sm outline-none ring-0 transition-colors focus:border-primary"
          />

          {error ? <div className="mt-4 rounded-2xl border border-error/30 bg-error-container px-4 py-3 text-sm text-on-error-container">{error}</div> : null}
          {message ? <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-200">{message}</div> : null}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary-surface mt-6 inline-flex h-12 w-full items-center justify-center rounded-2xl px-4 text-sm font-semibold transition-colors hover:brightness-110 disabled:opacity-60"
          >
            {loading ? "Enviando..." : "Enviar enlace"}
          </button>

          <Link href="/login" className="mt-4 block text-center text-sm text-primary hover:underline">
            Volver al inicio de sesión
          </Link>
        </form>
      </div>
    </main>
  );
}
