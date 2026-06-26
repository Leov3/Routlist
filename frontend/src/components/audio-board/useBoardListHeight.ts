"use client";

import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";

const MIN_LIST_HEIGHT = 220;
const LIST_BOTTOM_GAP = 16;
const VIEWPORT_BOTTOM_GAP = 24;

export function useBoardListHeight(containerRef: RefObject<HTMLElement | null>) {
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let frameId = 0;

    const measure = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const element = containerRef.current;
        if (!element) return;

        const playerBar = document.querySelector<HTMLElement>("[data-audio-player-bar]");
        const containerTop = element.getBoundingClientRect().top;
        const lowerBound = playerBar
          ? playerBar.getBoundingClientRect().top - LIST_BOTTOM_GAP
          : window.innerHeight - VIEWPORT_BOTTOM_GAP;
        const nextHeight = Math.max(MIN_LIST_HEIGHT, Math.floor(lowerBound - containerTop));

        setHeight((current) => (current === nextHeight ? current : nextHeight));
      });
    };

    measure();

    const observedPanel = container.closest("section");
    const playerBar = document.querySelector<HTMLElement>("[data-audio-player-bar]");
    const resizeObservers: ResizeObserver[] = [];

    if (typeof ResizeObserver !== "undefined") {
      if (observedPanel) {
        const observer = new ResizeObserver(measure);
        observer.observe(observedPanel);
        resizeObservers.push(observer);
      }

      if (playerBar) {
        const observer = new ResizeObserver(measure);
        observer.observe(playerBar);
        resizeObservers.push(observer);
      }
    }

    window.addEventListener("resize", measure);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", measure);
      resizeObservers.forEach((observer) => observer.disconnect());
    };
  }, [containerRef]);

  return height
    ? ({
        height: `${height}px`,
        minHeight: `${Math.min(height, MIN_LIST_HEIGHT)}px`,
      } satisfies CSSProperties)
    : undefined;
}
