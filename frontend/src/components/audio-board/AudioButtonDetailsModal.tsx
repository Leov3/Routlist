"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Download, X } from "lucide-react";
import { mediaUrl } from "@/lib/api";
import type { BoardAudioButton } from "@/types/routlis";

export function AudioButtonDetailsModal({
  button,
  onClose,
}: {
  button: BoardAudioButton;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<"button" | "audio" | null>(null);
  const hasLabel = button.label.trim().length > 0;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function copyText(value: string, scope: "button" | "audio") {
    if (!value.trim()) return;
    await navigator.clipboard.writeText(value);
    setCopied(scope);
    window.setTimeout(() => setCopied(null), 1500);
  }

  const buttonText = button.description?.trim() || "Sin texto del botón";
  const audioText = button.audioAsset.transcript?.trim() || button.description?.trim() || "Sin texto disponible";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 px-4 py-4 backdrop-blur-md sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl overflow-hidden rounded-[28px] border border-outline-variant bg-surface shadow-[0_30px_90px_rgba(0,0,0,.28)]"
        onClick={(event) => event.stopPropagation()}
        onContextMenu={(event) => event.preventDefault()}
      >
        <div className="flex items-center justify-between border-b border-outline-variant px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-on-surface-variant">Detalles del botón</p>
            {hasLabel ? (
              <h3 className="mt-1 text-xl font-semibold text-on-surface">{button.label}</h3>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-0 lg:grid-cols-[1.05fr_.95fr]">
          <div className="border-b border-outline-variant p-5 lg:border-b-0 lg:border-r">
            <div className="overflow-hidden rounded-[22px] border border-outline-variant bg-surface-container">
              {button.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaUrl(button.imageUrl)}
                  alt={button.label}
                  className="h-[320px] w-full object-cover"
                />
              ) : (
                <div className="flex h-[320px] items-center justify-center text-sm text-on-surface-variant">
                  Este botón no tiene imagen todavía.
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {button.imageDownloadUrl ? (
                <a
                  href={mediaUrl(button.imageDownloadUrl)}
                  className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-4 py-2 text-sm text-on-surface transition-colors hover:bg-surface-container-high"
                >
                  <Download className="h-4 w-4" />
                  Descargar imagen
                </a>
              ) : null}
              {button.audioAsset.audioDownloadUrl ? (
                <a
                  href={mediaUrl(button.audioAsset.audioDownloadUrl)}
                  className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:brightness-110"
                >
                  <Download className="h-4 w-4" />
                  Descargar audio
                </a>
              ) : null}
            </div>
          </div>

          <div className="p-5">
            <div className="space-y-4">
              <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Texto del botón</p>
                <p className="mt-2 text-sm leading-6 text-on-surface">{buttonText}</p>
              </div>

              <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Texto del audio</p>
                    <p className="mt-2 text-sm leading-6 text-on-surface">{audioText}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyText(audioText, "audio")}
                    className="inline-flex shrink-0 items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-3 py-2 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container-high"
                  >
                    {copied === "audio" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied === "audio" ? "Copiado" : "Copiar"}
                  </button>
                </div>
              </div>

              {button.description ? (
                <div className="rounded-[20px] border border-outline-variant bg-surface-container p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Texto adicional</p>
                      <p className="mt-2 text-sm leading-6 text-on-surface">{button.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void copyText(button.description ?? "", "button")}
                      className="inline-flex shrink-0 items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-3 py-2 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container-high"
                    >
                      {copied === "button" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied === "button" ? "Copiado" : "Copiar"}
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="rounded-[20px] border border-outline-variant bg-surface-container p-4 text-sm text-on-surface-variant">
                <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant">Audio</p>
                <p className="mt-2 text-on-surface">{button.audioAsset.originalName}</p>
                <p className="mt-1">
                  {button.audioAsset.durationSeconds
                    ? `${button.audioAsset.durationSeconds}s`
                    : "Duración no disponible"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
