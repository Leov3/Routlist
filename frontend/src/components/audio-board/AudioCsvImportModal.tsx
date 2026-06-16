"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileAudio, Files, X } from "lucide-react";
import type { CsvImportQueueItem, CsvImportResult, CsvPreview } from "@/components/audio-board/audio-csv-types";

type Props = {
  open: boolean;
  preview: CsvPreview | null;
  queue: CsvImportQueueItem[];
  busy?: boolean;
  onConfirmImport: () => Promise<CsvImportResult>;
  onClose: () => void;
};

export function AudioCsvImportModal({ open, preview, queue, busy = false, onConfirmImport, onClose }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<CsvImportResult | null>(null);

  const rows = useMemo(() => result?.queue ?? queue, [queue, result?.queue]);

  useEffect(() => {
    if (!open) return;
    setResult(null);
    setErrorMessage(null);
    setConfirming(false);
  }, [open]);

  if (!open) return null;

  async function confirm() {
    setConfirming(true);
    setErrorMessage(null);
    try {
      const next = await onConfirmImport();
      setResult(next);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo confirmar la importación.");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4 py-4 backdrop-blur-md" onClick={onClose}>
      <div
        className="flex h-[calc(100dvh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-outline-variant bg-surface shadow-[0_30px_90px_rgba(0,0,0,.45)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative border-b border-outline-variant px-5 py-4">
          <p className="text-[11px] uppercase tracking-[0.24em] text-on-surface-variant">Importación CSV</p>
          <h3 className="mt-1 text-xl font-semibold text-on-surface">
            {result ? "Importación confirmada" : "Revisar importación CSV"}
          </h3>
          <p className="mt-2 text-sm leading-6 text-on-surface-variant">Revisa coincidencias y faltantes antes de persistir los audios.</p>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-surface-container text-on-surface-variant"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {errorMessage ? <div className="border-b border-red-500/20 bg-red-500/10 px-5 py-3 text-sm text-red-300">{errorMessage}</div> : null}

        <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-5 lg:grid-cols-[1.05fr_.95fr]">
          <div className="rounded-[24px] border border-outline-variant bg-surface-container p-4">
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Filas" value={String(preview?.totalRows ?? 0)} />
              <Stat label="Coincidencias" value={String(preview?.matchedCount ?? 0)} />
              <Stat label="Faltantes" value={String(preview?.missingCount ?? 0)} />
            </div>
            {preview?.duplicates?.length ? (
              <p className="mt-3 text-sm text-amber-300">Duplicados: {preview.duplicates.join(", ")}</p>
            ) : null}
            <div className="mt-4 max-h-[calc(100dvh-18rem)] overflow-auto rounded-2xl border border-outline-variant">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-container-high text-xs uppercase text-on-surface-variant">
                  <tr>
                    <th className="px-4 py-3">Archivo</th>
                    <th className="px-4 py-3">Texto</th>
                    <th className="px-4 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-t border-outline-variant/60">
                      <td className="px-4 py-3 text-on-surface">{row.fileName}</td>
                      <td className="px-4 py-3 text-on-surface-variant">{row.text}</td>
                      <td className="px-4 py-3">
                        <span className={row.status === "MATCHED" ? "text-emerald-400" : "text-amber-400"}>{row.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-4 rounded-[24px] border border-outline-variant bg-surface-container p-4">
            <div className="rounded-2xl border border-outline-variant bg-surface p-4">
              <div className="flex items-start gap-3">
                {result ? <CheckCircle2 className="mt-0.5 h-6 w-6 text-emerald-300" /> : <AlertTriangle className="mt-0.5 h-6 w-6 text-amber-300" />}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-on-surface">{result ? "Importación completada" : "Revisión previa"}</p>
                  <p className="mt-1 text-sm leading-6 text-on-surface-variant">
                    {result
                      ? result.createdCount > 0
                        ? `Se crearon ${result.createdCount} audio(s) y se omitieron ${result.skippedCount}. Ahora se abrirá el modal para crear botones.`
                        : `No se crearon audios. Se omitieron ${result.skippedCount} fila(s); revisa archivos faltantes o errores antes de continuar.`
                      : "Confirma la importación para persistir los audios en la biblioteca y continuar con la creación de botones."}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Stat label="Creados" value={String(result?.createdCount ?? 0)} />
              <Stat label="Omitidos" value={String(result?.skippedCount ?? 0)} />
            </div>

            <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-outline-variant bg-surface p-4">
              <div className="flex items-center gap-2">
                <Files className="h-4 w-4 text-on-surface-variant" />
                <p className="text-sm font-semibold text-on-surface">Resultado</p>
              </div>
              <div className="mt-3 min-h-0 flex-1 overflow-auto">
                {result ? (
                  <div className="space-y-2 text-sm text-on-surface-variant">
                    {result.assets.length ? (
                      result.assets.map((asset) => (
                        <div key={asset.id} className="rounded-xl border border-outline-variant bg-surface-container px-3 py-2">
                          <div className="flex items-center gap-2">
                            <FileAudio className="h-4 w-4 text-primary" />
                            <span className="font-medium text-on-surface">{asset.originalName}</span>
                          </div>
                          <p className="mt-1 text-xs text-on-surface-variant">{asset.mimeType}</p>
                        </div>
                      ))
                    ) : (
                      <p>No se crearon audios.</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-on-surface-variant">
                    Aquí verás el resultado final luego de confirmar.
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              {!result ? (
                <button
                  type="button"
                  onClick={() => void confirm()}
                  disabled={busy || confirming}
                  className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50"
                >
                  {confirming ? "Confirmando..." : "Confirmar importación"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">{label}</p>
      <p className="mt-1 text-sm font-semibold text-on-surface">{value}</p>
    </div>
  );
}
