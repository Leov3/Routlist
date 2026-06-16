"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";

export default function ResetPasswordClient() {
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);
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
      setError("Falta el token de recuperación.");
      return;
    }
    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      await api("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword: password }),
      });
      setMessage("Tu contraseña fue actualizada. Ya puedes iniciar sesión otra vez.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo restablecer la contraseña.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0b0d13] px-4 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center">
        <form className="w-full rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_30px_90px_rgba(0,0,0,.35)]" onSubmit={handleSubmit}>
          <p className="text-xs uppercase tracking-[0.22em] text-[#998cc6]">Recuperación</p>
          <h1 className="mt-2 text-3xl font-semibold">Restablecer contraseña</h1>
          <p className="mt-2 text-sm text-[#a39bb4]">Define una contraseña nueva para tu cuenta.</p>

          <label className="mt-6 block text-sm font-medium text-[#e9e4f5]">Nueva contraseña</label>
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            required
            className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-sm outline-none ring-0 transition-colors focus:border-[#8e5dff]"
          />
          <label className="mt-4 block text-sm font-medium text-[#e9e4f5]">Confirmar contraseña</label>
          <input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            type="password"
            required
            className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-sm outline-none ring-0 transition-colors focus:border-[#8e5dff]"
          />

          {error ? <div className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
          {message ? <div className="mt-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{message}</div> : null}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-[#8e5dff] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#a17cff] disabled:opacity-60"
          >
            {loading ? "Guardando..." : "Cambiar contraseña"}
          </button>

          <Link href="/login" className="mt-4 block text-center text-sm text-[#a99adf] hover:text-white">
            Volver al inicio de sesión
          </Link>
        </form>
      </div>
    </main>
  );
}
