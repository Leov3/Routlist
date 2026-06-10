"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, apiUrl } from "@/lib/api";
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
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const eventIdRef = useRef<string | null>(null);
  const [state, setState] = useState<PlaybackState>(initialState);

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const disconnectAudioGraph = useCallback(async () => {
    try {
      sourceNodeRef.current?.disconnect();
    } catch {
      // noop
    }
    try {
      gainNodeRef.current?.disconnect();
    } catch {
      // noop
    }
    sourceNodeRef.current = null;
    gainNodeRef.current = null;

    if (audioContextRef.current) {
      try {
        await audioContextRef.current.close();
      } catch {
        // noop
      }
      audioContextRef.current = null;
    }
  }, []);

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
    await disconnectAudioGraph();
    revokeObjectUrl();
  }, [disconnectAudioGraph, revokeObjectUrl]);

  const stop = useCallback(async () => {
    const gainNode = gainNodeRef.current;
    const audioContext = audioContextRef.current;

    if (gainNode && audioContext) {
      const now = audioContext.currentTime;
      gainNode.gain.cancelScheduledValues(now);
      gainNode.gain.setValueAtTime(gainNode.gain.value, now);
      gainNode.gain.linearRampToValueAtTime(0, now + 0.22);
      await new Promise((resolve) => window.setTimeout(resolve, 220));
    }

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

      const event = await api<{ id: string }>("/playback-events/start", {
        method: "POST",
        body: JSON.stringify({ audioButtonId: button.id }),
      });

      const response = await fetch(apiUrl(button.audioUrl), {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`No se pudo cargar el audio (${response.status})`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      objectUrlRef.current = objectUrl;

      const audio = new Audio();
      audio.src = objectUrl;
      audioRef.current = audio;
      audio.preload = "auto";
      startedAtRef.current = Date.now();
      eventIdRef.current = event.id;

      const audioContext = audioContextRef.current ?? new AudioContext();
      audioContextRef.current = audioContext;
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }
      const sourceNode = audioContext.createMediaElementSource(audio);
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0;
      sourceNode.connect(gainNode);
      gainNode.connect(audioContext.destination);
      sourceNodeRef.current = sourceNode;
      gainNodeRef.current = gainNode;

      audio.onended = () => {
        void finalizePlayback().then(() => setState(initialState));
      };

      audio.onerror = () => {
        void finalizePlayback().then(() => setState(initialState));
      };

      await audio.play();
      const effectiveVolume = Math.max(0, Math.min(1, volume));
      gainNode.gain.cancelScheduledValues(audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(
        effectiveVolume,
        audioContext.currentTime + 0.25,
      );
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
    const gainNode = gainNodeRef.current;
    const audioContext = audioContextRef.current;
    if (!gainNode || !audioContext) return;

    const effectiveVolume = Math.max(0, Math.min(1, masterVolume));
    const now = audioContext.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setTargetAtTime(effectiveVolume, now, 0.05);
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
