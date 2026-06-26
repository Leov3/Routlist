"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { ThemeToggleButton } from "@/components/layout/ThemeToggleButton";

export default function AcceptInviteClient() {
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!token) {
      setError("Falta el token de invitación.");
      return;
    }
    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      await api("/auth/accept-invite", {
        method: "POST",
        body: JSON.stringify({ token, fullName, password }),
      });
      setMessage("Tu acceso fue creado. Ya puedes iniciar sesión.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo aceptar la invitación.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-surface px-4 py-10 text-on-surface">
      <ThemeToggleButton behavior="binary" className="fixed right-4 top-4 z-20" />
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center">
        <form className="surface-panel w-full rounded-[28px] p-6" onSubmit={handleSubmit}>
          <p className="text-xs uppercase tracking-[0.22em] text-on-surface-variant">Invitación</p>
          <h1 className="mt-2 text-3xl font-semibold">Aceptar invitación</h1>
          <p className="mt-2 text-sm text-on-surface-variant">Completa tus datos para entrar a la organización.</p>

          <label className="mt-6 block text-sm font-medium text-on-surface">Nombre completo</label>
          <input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            type="text"
            required
            className="input-surface mt-2 h-12 w-full rounded-2xl px-4 text-sm outline-none ring-0 transition-colors focus:border-primary"
          />
          <label className="mt-4 block text-sm font-medium text-on-surface">Contraseña</label>
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            required
            className="input-surface mt-2 h-12 w-full rounded-2xl px-4 text-sm outline-none ring-0 transition-colors focus:border-primary"
          />
          <label className="mt-4 block text-sm font-medium text-on-surface">Confirmar contraseña</label>
          <input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            type="password"
            required
            className="input-surface mt-2 h-12 w-full rounded-2xl px-4 text-sm outline-none ring-0 transition-colors focus:border-primary"
          />

          {error ? <div className="mt-4 rounded-2xl border border-error/30 bg-error-container px-4 py-3 text-sm text-on-error-container">{error}</div> : null}
          {message ? <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-200">{message}</div> : null}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary-surface mt-6 inline-flex h-12 w-full items-center justify-center rounded-2xl px-4 text-sm font-semibold transition-colors hover:brightness-110 disabled:opacity-60"
          >
            {loading ? "Procesando..." : "Aceptar invitación"}
          </button>

          <Link href="/login" className="mt-4 block text-center text-sm text-primary hover:underline">
            Volver al inicio de sesión
          </Link>
        </form>
      </div>
    </main>
  );
}
