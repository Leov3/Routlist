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
  const startedAtRef = useRef<number | null>(null);
  const eventIdRef = useRef<string | null>(null);
  const [state, setState] = useState<PlaybackState>(initialState);

  const finalizePlayback = useCallback(async () => {
    const eventId = eventIdRef.current;

    if (eventId) {
      const durationPlayedSeconds = startedAtRef.current
        ? Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000))
        : undefined;

      eventIdRef.current = null;
      await api(`/playback-events/${eventId}/stop`, {
        method: "PATCH",
        body: JSON.stringify({ durationPlayedSeconds }),
      }).catch(() => undefined);
    }

    startedAtRef.current = null;
  }, []);

  const stop = useCallback(async () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    await finalizePlayback();
    setState(initialState);
  }, [finalizePlayback]);

  const playButton = useCallback(
    async (button: BoardAudioButton, volume = 1) => {
      await stop();

      const audio = new Audio();
      audio.src = mediaUrl(button.audioUrl);
      audioRef.current = audio;
      audio.preload = "auto";
      audio.volume = Math.max(0, Math.min(1, volume));
      audio.crossOrigin = "use-credentials";

      const playPromise = audio.play();

      const event = await api<{ id: string }>("/playback-events/start", {
        method: "POST",
        body: JSON.stringify({ audioButtonId: button.id }),
      });

      startedAtRef.current = Date.now();
      eventIdRef.current = event.id;

      audio.onended = () => {
        void finalizePlayback().then(() => setState(initialState));
      };

      audio.onerror = () => {
        void finalizePlayback().then(() => setState(initialState));
      };

      await playPromise;
      setState({
        activeButtonId: button.id,
        activeAudioUrl: button.audioUrl,
        activeEventId: event.id,
        activeLabel: button.label,
        activeTranscript: button.audioAsset.transcript ?? null,
        audioElement: audio,
        isPlaying: true,
        isPaused: false,
      });
    },
    [finalizePlayback, stop],
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

  return { state, playButton, stop, pause, resume };
}
