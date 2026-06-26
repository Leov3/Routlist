"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAudioPlayback } from "@/modules/audio-board/useAudioPlayback";
import type { BoardCategory, RecentPlaybackEvent } from "@/types/routlis";
import { AudioButtonDetailsModal } from "@/components/audio-board/AudioButtonDetailsModal";
import { BoardSidePanel } from "@/components/audio-board/BoardSidePanel";
import { createDefaultSideState, type BoardButton, type BoardCategoryOption, type BoardSideState } from "@/components/audio-board/board-ui";

const RECENT_LIMIT = 12;

export function NarrativeAudioLibraryPanel() {
  const [categories, setCategories] = useState<BoardCategory[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [recentEvents, setRecentEvents] = useState<RecentPlaybackEvent[]>([]);
  const [side, setSide] = useState<BoardSideState>(() => createDefaultSideState());
  const [loading, setLoading] = useState(true);
  const [detailsButtonId, setDetailsButtonId] = useState<string | null>(null);
  const volume = 1;
  const playback = useAudioPlayback(volume);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      try {
        const boardData = await api<BoardCategory[]>("/audio-buttons/board");
        if (cancelled) return;
        setCategories(boardData);
        setFavoriteIds(
          boardData.flatMap((category) =>
            category.buttons.filter((button) => button.isFavorite).map((button) => button.id),
          ),
        );
      } catch {
        if (!cancelled) {
          setCategories([]);
          setFavoriteIds([]);
        }
      }

      try {
        const recentData = await api<RecentPlaybackEvent[]>(
          `/playback-events/recent?limit=${RECENT_LIMIT}&scope=organization`,
        );
        if (!cancelled) setRecentEvents(recentData);
      } catch {
        if (!cancelled) setRecentEvents([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const flattenedButtons = useMemo<BoardButton[]>(
    () =>
      categories.flatMap((category) =>
        category.buttons.map((button) => ({
          ...button,
          category: {
            id: category.id,
            name: category.name,
          },
        })),
      ),
    [categories],
  );

  const categoryOptions = useMemo<BoardCategoryOption[]>(
    () =>
      categories.map((category) => ({
        id: category.id,
        name: category.name,
        count: category.buttons.length,
      })),
    [categories],
  );

  const recentIds = useMemo(
    () => recentEvents.map((event) => event.audioButton.id),
    [recentEvents],
  );

  async function refreshRecent() {
    const recentData = await api<RecentPlaybackEvent[]>(
      `/playback-events/recent?limit=${RECENT_LIMIT}&scope=organization`,
    ).catch(() => []);
    setRecentEvents(recentData);
  }

  async function toggleFavorite(buttonId: string) {
    const nextFavorite = !favoriteIds.includes(buttonId);
    setFavoriteIds((current) =>
      nextFavorite
        ? [buttonId, ...current.filter((id) => id !== buttonId)]
        : current.filter((id) => id !== buttonId),
    );

    await api(`/audio-buttons/${buttonId}/favorite`, {
      method: nextFavorite ? "POST" : "DELETE",
    }).catch(() => undefined);
  }

  const selectedButton = useMemo(
    () => flattenedButtons.find((button) => button.id === detailsButtonId) ?? null,
    [detailsButtonId, flattenedButtons],
  );

  if (loading) {
    return (
      <section className="flex h-full min-h-[420px] items-center justify-center rounded-[28px] border border-outline-variant bg-surface-container-high p-6 shadow-[0_0_0_1px_rgba(124,58,237,.08),0_28px_60px_rgba(0,0,0,.12)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-outline-variant border-t-primary" />
          <p className="text-sm text-on-surface-variant">Cargando botonera auxiliar...</p>
        </div>
      </section>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-4">
      <BoardSidePanel
        title="Botonera auxiliar"
        subtitle="Biblioteca de audios para apoyar la narrativa"
        tone="violet"
        buttons={flattenedButtons}
        categoryOptions={categoryOptions}
        side={side}
        favoriteIds={favoriteIds}
        recentIds={recentIds}
        activeButtonId={playback.state.activeButtonId}
        density="medium"
        onPlay={(button) => {
          void playback
            .playButton(button, volume)
            .then(() => {
              void refreshRecent();
            })
            .catch(() => undefined);
        }}
        onToggleFavorite={(button) => {
          void toggleFavorite(button.id);
        }}
        onOpenDetails={(button) => setDetailsButtonId(button.id)}
        onSideChange={setSide}
        onStop={() => void playback.stop()}
      />

      {selectedButton ? (
        <AudioButtonDetailsModal
          button={selectedButton}
          onClose={() => setDetailsButtonId(null)}
        />
      ) : null}
    </div>
  );
}
