"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, mediaUrl } from "@/lib/api";
import type { BoardAudioButton } from "@/types/routlis";

type PlaybackState = {
  activeButtonId: string | null;
  activeAudioUrl: string | null;
  activeEventId: string | null;
  activeLabel: string | null;
  activeTranscript: string | null;
  audioElement: HTMLAudioElement | null;
  isPlaying: boolean;
  isPaused: boolean;
};

const initialState: PlaybackState = {
  activeButtonId: null,
  activeAudioUrl: null,
  activeEventId: null,
  activeLabel: null,
  activeTranscript: null,
  audioElement: null,
  isPlaying: false,
  isPaused: false,
};

export function useAudioPlayback(masterVolume = 1) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const warmCacheRef = useRef(new Map<string, HTMLAudioElement>());
  const startedAtRef = useRef<number | null>(null);
  const eventIdRef = useRef<string | null>(null);
  const [state, setState] = useState<PlaybackState>(initialState);

  const finalizePlaybackEvent = useCallback(
    async (eventId: string | null, startedAt: number | null) => {
      if (!eventId) return;

      const durationPlayedSeconds = startedAt
        ? Math.max(0, Math.round((Date.now() - startedAt) / 1000))
        : undefined;

      await api(`/playback-events/${eventId}/stop`, {
        method: "PATCH",
        body: JSON.stringify({ durationPlayedSeconds }),
      }).catch(() => undefined);
    },
    [],
  );

  const finalizeCurrentPlayback = useCallback(async () => {
    const eventId = eventIdRef.current;
    const startedAt = startedAtRef.current;
    if (eventId) {
      eventIdRef.current = null;
      startedAtRef.current = null;
      await finalizePlaybackEvent(eventId, startedAt);
    }
  }, [finalizePlaybackEvent]);

  const stop = useCallback(async () => {
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    await finalizeCurrentPlayback();
    setState(initialState);
  }, [finalizeCurrentPlayback]);

  const preloadButton = useCallback((button: BoardAudioButton) => {
    if (warmCacheRef.current.has(button.audioUrl)) return;

    const audio = new Audio();
    audio.preload = "auto";
    audio.crossOrigin = "use-credentials";
    audio.src = mediaUrl(button.audioUrl);
    audio.load();
    warmCacheRef.current.set(button.audioUrl, audio);
  }, []);

  const playButton = useCallback(
    async (button: BoardAudioButton, volume = 1) => {
      const previousAudio = audioRef.current;
      const previousEventId = eventIdRef.current;
      const previousStartedAt = startedAtRef.current;

      if (previousAudio) {
        previousAudio.onended = null;
        previousAudio.onerror = null;
        previousAudio.pause();
        previousAudio.currentTime = 0;
      }

      audioRef.current = null;
      eventIdRef.current = null;
      startedAtRef.current = null;
      if (previousEventId) {
        void finalizePlaybackEvent(previousEventId, previousStartedAt);
      }

      const cachedAudio = warmCacheRef.current.get(button.audioUrl) ?? null;
      const audio = cachedAudio ?? new Audio();
      audio.preload = "auto";
      audio.crossOrigin = "use-credentials";
      audio.volume = Math.max(0, Math.min(1, volume));
      if (!cachedAudio) {
        audio.src = mediaUrl(button.audioUrl);
      }
      audioRef.current = audio;
      warmCacheRef.current.delete(button.audioUrl);

      audio.onended = () => {
        if (audioRef.current === audio) {
          audioRef.current = null;
        }
        const currentEventId = eventIdRef.current;
        const currentStartedAt = startedAtRef.current;
        eventIdRef.current = null;
        startedAtRef.current = null;
        void finalizePlaybackEvent(currentEventId, currentStartedAt).then(() => {
          setState(initialState);
        });
      };

      audio.onerror = () => {
        if (audioRef.current === audio) {
          audioRef.current = null;
        }
        const currentEventId = eventIdRef.current;
        const currentStartedAt = startedAtRef.current;
        eventIdRef.current = null;
        startedAtRef.current = null;
        void finalizePlaybackEvent(currentEventId, currentStartedAt).then(() => {
          setState(initialState);
        });
      };

      setState({
        activeButtonId: button.id,
        activeAudioUrl: button.audioUrl,
        activeEventId: null,
        activeLabel: button.label,
        activeTranscript: button.audioAsset.transcript ?? null,
        audioElement: audio,
        isPlaying: true,
        isPaused: false,
      });

      const playPromise = audio.play();

      void api<{ id: string }>("/playback-events/start", {
        method: "POST",
        body: JSON.stringify({ audioButtonId: button.id }),
      })
        .then((event) => {
          if (audioRef.current !== audio) return;
          startedAtRef.current = Date.now();
          eventIdRef.current = event.id;
          setState((current) =>
            current.audioElement === audio
              ? { ...current, activeEventId: event.id }
              : current,
          );
        })
        .catch(() => undefined);

      try {
        await playPromise;
      } catch {
        if (audioRef.current === audio) {
          audioRef.current = null;
        }
        const currentEventId = eventIdRef.current;
        const currentStartedAt = startedAtRef.current;
        eventIdRef.current = null;
        startedAtRef.current = null;
        await finalizePlaybackEvent(currentEventId, currentStartedAt);
        setState(initialState);
      }
    },
    [finalizePlaybackEvent],
  );

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, masterVolume));
    }
  }, [masterVolume]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setState((current) => ({ ...current, isPlaying: false, isPaused: true }));
  }, []);

  const resume = useCallback(async () => {
    await audioRef.current?.play();
    setState((current) => ({ ...current, isPlaying: true, isPaused: false }));
  }, []);

  return { state, playButton, preloadButton, stop, pause, resume };
}
