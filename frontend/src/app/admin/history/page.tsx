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
        <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container">
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
      ) : (
        <DataState>No hay reproducciones registradas.</DataState>
      )}
    </AdminProtectedPage>
  );
}
