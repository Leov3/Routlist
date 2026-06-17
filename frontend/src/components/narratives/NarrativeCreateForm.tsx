"use client";

import { useState } from "react";
import { Plus, Sparkles } from "lucide-react";

type NarrativeCreateFormProps = {
  onCreate: (values: { title: string; description: string }) => Promise<void>;
  submitLabel?: string;
};

export function NarrativeCreateForm({
  onCreate,
  submitLabel = "Crear narrativa",
}: NarrativeCreateFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      await onCreate({
        title: title.trim(),
        description: description.trim(),
      });
      setTitle("");
      setDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la narrativa.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[28px] border border-outline-variant bg-surface-container p-5 shadow-elevation-1"
    >
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-on-primary">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-on-surface">
            Nueva narrativa
          </h2>
          <p className="text-sm text-on-surface-variant">
            Crea un borrador para diseñar el flujo por nodos.
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        <label className="grid gap-1.5">
          <span className="text-xs font-medium uppercase tracking-widest text-on-surface-variant">
            Título
          </span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Narrativa de apertura"
            className="h-11 rounded-2xl border border-outline-variant bg-surface px-4 text-sm text-on-surface outline-none transition-colors focus:border-primary"
            required
            minLength={3}
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-medium uppercase tracking-widest text-on-surface-variant">
            Descripción
          </span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Guion operativo para el equipo"
            className="min-h-24 rounded-2xl border border-outline-variant bg-surface px-4 py-3 text-sm text-on-surface outline-none transition-colors focus:border-primary"
          />
        </label>
      </div>

      {error && (
        <p className="danger-surface mt-4 rounded-2xl px-4 py-3 text-sm">
          {error}
        </p>
      )}

      <div className="mt-5 flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-11 items-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-on-primary transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70"
        >
          <Plus className="h-4 w-4" />
          {saving ? "Creando..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
