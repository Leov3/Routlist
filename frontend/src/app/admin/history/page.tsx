"use client";

import { useEffect, useState } from "react";
import { AdminProtectedPage } from "@/components/layout/AdminProtectedPage";
import { DataState } from "@/components/ui/DataState";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import type { PlaybackEvent } from "@/types/routlis";

export default function HistoryPage() {
  const [events, setEvents] = useState<PlaybackEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<PlaybackEvent[]>("/audit/playback-events")
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminProtectedPage>
      <PageHeader title="Historial" description="Ultimas reproducciones registradas." />
      {loading ? (
        <DataState>Cargando historial...</DataState>
      ) : events.length ? (
        <>
          <div className="space-y-3 md:hidden">
            {events.map((event) => (
              <HistoryCard key={event.id} event={event} />
            ))}
          </div>
          <div className="hidden overflow-hidden rounded-xl border border-outline-variant bg-surface-container md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-container-high text-xs uppercase text-on-surface-variant">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3">Boton</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Duracion</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-t border-outline-variant">
                  <td className="px-4 py-3 text-on-surface-variant">
                    {new Date(event.startedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-medium">{event.user.fullName}</td>
                  <td className="px-4 py-3">{event.audioButton.label}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{event.audioButton.category.name}</td>
                  <td className="px-4 py-3">
                    {event.durationPlayedSeconds ?? 0}s
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      ) : (
        <DataState>No hay reproducciones registradas.</DataState>
      )}
    </AdminProtectedPage>
  );
}

function HistoryCard({ event }: { event: PlaybackEvent }) {
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-on-surface">{event.audioButton.label}</p>
          <p className="mt-1 truncate text-xs text-on-surface-variant">{event.audioButton.category.name}</p>
        </div>
        <span className="rounded-full border border-outline-variant bg-surface px-2.5 py-1 text-[10px] font-semibold text-on-surface">
          {event.durationPlayedSeconds ?? 0}s
        </span>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-on-surface-variant">
        <div className="flex items-center justify-between gap-3">
          <span>Fecha</span>
          <span className="font-medium text-on-surface">{new Date(event.startedAt).toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Usuario</span>
          <span className="truncate font-medium text-on-surface">{event.user.fullName}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Categoría</span>
          <span className="truncate font-medium text-on-surface">{event.audioButton.category.name}</span>
        </div>
      </div>
    </div>
  );
}
