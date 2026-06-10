"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "@/lib/api";
import { useAudioPlayback } from "@/modules/audio-board/useAudioPlayback";
import type {
  BoardCategory,
  BoardDensity,
  BoardPreferences,
  BoardViewMode,
  RecentPlaybackEvent,
} from "@/types/routlis";
import { AudioButton } from "./AudioButton";
import { AudioButtonDetailsModal } from "./AudioButtonDetailsModal";
import { AudioPlayerBar } from "./AudioPlayerBar";
import { AudioSearch } from "./AudioSearch";
import { BoardDensityToggle } from "./BoardDensityToggle";
import { BoardFilterChips } from "./BoardFilterChips";
import { BoardMoreFiltersMenu } from "./BoardMoreFiltersMenu";
import { BoardRecentStrip } from "./BoardRecentStrip";
import { BoardSidePanel } from "./BoardSidePanel";
import { BoardViewModeToggle } from "./BoardViewModeToggle";
import {
  createDefaultSideState,
  filterBoardButtons,
  type BoardButton,
  type BoardCategoryOption,
  type BoardSideState,
} from "./board-ui";

const DEFAULT_PREFERENCES: BoardPreferences = {
  viewMode: "simple",
  density: "medium",
  volume: 1,
};

const RECENT_LIMIT = 12;

export function AudioBoard() {
  const [categories, setCategories] = useState<BoardCategory[]>([]);
  const [viewMode, setViewMode] = useState<BoardViewMode>(DEFAULT_PREFERENCES.viewMode);
  const [density, setDensity] = useState<BoardDensity>(DEFAULT_PREFERENCES.density);
  const [volume, setVolume] = useState(DEFAULT_PREFERENCES.volume);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [sideA, setSideA] = useState<BoardSideState>(() => createDefaultSideState());
  const [sideB, setSideB] = useState<BoardSideState>(() => createDefaultSideState());
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [recentEvents, setRecentEvents] = useState<RecentPlaybackEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailsButtonId, setDetailsButtonId] = useState<string | null>(null);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const playback = useAudioPlayback(volume);
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setHeaderSlot(document.getElementById("board-header-slot"));
  }, []);

  useEffect(() => {
    async function load() {
      let boardData: BoardCategory[] = [];

      try {
        boardData = await api<BoardCategory[]>("/audio-buttons/board");
        setCategories(boardData);
        setFavoriteIds(
          boardData.flatMap((category) =>
            category.buttons.filter((button) => button.isFavorite).map((button) => button.id),
          ),
        );
      } catch {
        setCategories([]);
        setFavoriteIds([]);
      }

      try {
        const prefsData = await api<BoardPreferences>("/me/board-preferences");
        setViewMode(prefsData.viewMode ?? DEFAULT_PREFERENCES.viewMode);
        setDensity(prefsData.density ?? DEFAULT_PREFERENCES.density);
        setVolume(prefsData.volume ?? DEFAULT_PREFERENCES.volume);
      } catch {
        setViewMode(DEFAULT_PREFERENCES.viewMode);
        setDensity(DEFAULT_PREFERENCES.density);
        setVolume(DEFAULT_PREFERENCES.volume);
      }

      try {
        const recentData = await api<RecentPlaybackEvent[]>(
          `/playback-events/recent?limit=${RECENT_LIMIT}&scope=organization`,
        );
        setRecentEvents(recentData);
      } catch {
        setRecentEvents([]);
      } finally {
        setLoading(false);
        setPreferencesReady(true);
      }
    }

    void load();
  }, []);

  useEffect(() => {
    if (!preferencesReady) return;

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      void api("/me/board-preferences", {
        method: "PATCH",
        body: JSON.stringify({ viewMode, density, volume }),
      }).catch(() => undefined);
    }, 250);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [density, preferencesReady, viewMode, volume]);

  const flattenedButtons = useMemo<BoardButton[]>(() => {
    return categories.flatMap((category) =>
      category.buttons.map((button) => ({
        ...button,
        category: {
          id: category.id,
          name: category.name,
        },
      })),
    );
  }, [categories]);

  const categoryOptions = useMemo<BoardCategoryOption[]>(() => {
    return categories.map((category) => ({
      id: category.id,
      name: category.name,
      count: category.buttons.length,
    }));
  }, [categories]);

  const recentIds = useMemo(
    () => recentEvents.map((event) => event.audioButton.id),
    [recentEvents],
  );

  const simpleVisibleButtons = useMemo(
    () =>
      filterBoardButtons({
        buttons: flattenedButtons,
        side: sideA,
        favoriteIds,
        recentIds,
      }),
    [favoriteIds, flattenedButtons, recentIds, sideA],
  );

  const selectedButton = useMemo(
    () => flattenedButtons.find((button) => button.id === detailsButtonId) ?? null,
    [detailsButtonId, flattenedButtons],
  );

  const playButtonById = async (buttonId: string) => {
    const button = flattenedButtons.find((entry) => entry.id === buttonId);
    if (!button) return;

    await playback.playButton(button, volume);
    await refreshRecent();
  };

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

  function changeQuickFilter(
    side: "a" | "b",
    nextFilter: "all" | "favorites" | "recent",
    currentSide: BoardSideState,
  ) {
    const nextSide = {
      ...currentSide,
      quickFilter: nextFilter,
      selectedCategoryId: nextFilter === "all" ? currentSide.selectedCategoryId : "all",
    };

    if (side === "a") {
      setSideA(nextSide);
    } else {
      setSideB(nextSide);
    }
  }

  function swapSides() {
    setSideA(sideB);
    setSideB(sideA);
  }

  function changeViewMode(next: BoardViewMode) {
    setViewMode(next);
    if (viewMode === "simple" && next === "dual") {
      setSideB(sideA);
    }
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        void playback.stop();
        return;
      }

      const shortcut = event.key.trim().toLowerCase();
      if (!shortcut) return;

      const match = flattenedButtons.find(
        (button) => button.shortcutKey?.trim().toLowerCase() === shortcut,
      );

      if (!match) return;

      event.preventDefault();
      void playButtonById(match.id);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [flattenedButtons, playback, volume]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-outline-variant border-t-primary" />
          <p className="text-sm text-on-surface-variant">Cargando botonera...</p>
        </div>
      </div>
    );
  }

  const gridClass =
    density === "compact"
      ? "md:grid-cols-4 xl:grid-cols-6"
      : density === "large"
        ? "md:grid-cols-2 xl:grid-cols-3"
        : "md:grid-cols-3 xl:grid-cols-5";

  return (
    <div className="pb-[190px]">
      {headerSlot
        ? createPortal(
            <div className="flex w-full min-w-0 items-center justify-center">
              <div className="flex max-w-full flex-wrap items-center justify-center gap-3 rounded-full border border-outline-variant/70 bg-surface-container/80 px-4 py-2 shadow-[0_10px_30px_rgba(0,0,0,.14)] backdrop-blur-md">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary shadow-[0_0_0_1px_rgba(124,58,237,.14)]">
                  <span className="text-sm font-bold">B</span>
                </div>

                <h1 className="truncate text-[15px] font-semibold tracking-tight text-on-surface sm:text-base">
                  /Botonera
                </h1>

                <BoardViewModeToggle value={viewMode} onChange={changeViewMode} />
                <BoardDensityToggle value={density} onChange={setDensity} />
              </div>
            </div>,
            headerSlot,
          )
        : null}

      <BoardRecentStrip events={recentEvents} onPlay={(buttonId) => void playButtonById(buttonId)} />

      {viewMode === "simple" ? (
        <section className="flex max-h-[calc(100dvh-20rem)] flex-col overflow-hidden rounded-[28px] border border-outline-variant bg-surface-container-high p-5 shadow-[0_0_0_1px_rgba(124,58,237,.08),0_28px_60px_rgba(0,0,0,.12)]">
          <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center">
            <AudioSearch
              value={sideA.search}
              onChange={(value) => setSideA((current) => ({ ...current, search: value }))}
              placeholder="Buscar audios..."
              className="min-w-0 flex-1"
            />

            <div className="flex flex-1 items-center gap-2 overflow-x-auto pb-1 xl:justify-start">
              <BoardFilterChips
                categoryOptions={categoryOptions}
                selectedCategoryId={sideA.selectedCategoryId}
                onSelectCategory={(categoryId) =>
                  setSideA((current) => ({ ...current, selectedCategoryId: categoryId }))
                }
                quickFilter={sideA.quickFilter}
                onQuickFilterChange={(next) => changeQuickFilter("a", next, sideA)}
              />
            </div>

            <BoardMoreFiltersMenu
              quickFilter={sideA.quickFilter}
              onQuickFilterChange={(next) => changeQuickFilter("a", next, sideA)}
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {simpleVisibleButtons.length ? (
              <div className={`grid gap-3 ${gridClass}`}>
                {simpleVisibleButtons.map((button) => (
                  <AudioButton
                    key={button.id}
                    button={button}
                    active={playback.state.activeButtonId === button.id}
                    isFavorite={favoriteIds.includes(button.id)}
                    density={density}
                    onPlay={(currentButton) => {
                      void playback
                        .playButton(currentButton, volume)
                        .then(() => {
                          void refreshRecent();
                        })
                        .catch(() => undefined);
                    }}
                    onToggleFavorite={(currentButton) => {
                      void toggleFavorite(currentButton.id);
                    }}
                    onOpenDetails={(currentButton) => setDetailsButtonId(currentButton.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-[24px] border border-dashed border-outline-variant bg-surface py-20 text-sm text-on-surface-variant">
                No hay botones disponibles.
              </div>
            )}
          </div>
        </section>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <BoardSidePanel
            title="Lado A"
            subtitle="Audios del lado A"
            tone="violet"
            buttons={flattenedButtons}
            categoryOptions={categoryOptions}
            side={sideA}
            favoriteIds={favoriteIds}
            recentIds={recentIds}
            activeButtonId={playback.state.activeButtonId}
            density={density}
            onPlay={(currentButton) => {
              void playback
                .playButton(currentButton, volume)
                .then(() => {
                  void refreshRecent();
                })
                .catch(() => undefined);
            }}
            onToggleFavorite={(currentButton) => {
              void toggleFavorite(currentButton.id);
            }}
            onOpenDetails={(currentButton) => setDetailsButtonId(currentButton.id)}
            onSwapSides={swapSides}
            onSideChange={setSideA}
          />

          <BoardSidePanel
            title="Lado B"
            subtitle="Audios del lado B"
            tone="teal"
            buttons={flattenedButtons}
            categoryOptions={categoryOptions}
            side={sideB}
            favoriteIds={favoriteIds}
            recentIds={recentIds}
            activeButtonId={playback.state.activeButtonId}
            density={density}
            onPlay={(currentButton) => {
              void playback
                .playButton(currentButton, volume)
                .then(() => {
                  void refreshRecent();
                })
                .catch(() => undefined);
            }}
            onToggleFavorite={(currentButton) => {
              void toggleFavorite(currentButton.id);
            }}
            onOpenDetails={(currentButton) => setDetailsButtonId(currentButton.id)}
            onSwapSides={swapSides}
            onSideChange={setSideB}
          />
        </div>
      )}

      <AudioPlayerBar
        label={playback.state.activeLabel}
        transcript={playback.state.activeTranscript}
        audioElement={playback.state.audioElement}
        isPlaying={playback.state.isPlaying}
        isPaused={playback.state.isPaused}
        onPause={playback.pause}
        onResume={() => void playback.resume()}
        onStop={() => void playback.stop()}
        volume={volume}
        onVolumeChange={setVolume}
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
