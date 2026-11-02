"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const POLL_MS = 12_000;

/**
 * Keep server data fresh without a manual refresh: fetch now, every 12 seconds while the tab is
 * visible, and again whenever the tab is shown or focused. `fetcher` must be stable (useCallback).
 * `at` is when the data was last fetched, for the "Updated x ago" label.
 */
export function useLive<T>(fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [at, setAt] = useState<number | null>(null);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      setData(await fetcher());
      setAt(Date.now());
    } catch {
      /* keep the last good data; the next poll tries again */
    } finally {
      busy.current = false;
    }
  }, [fetcher]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    const tick = setInterval(() => document.visibilityState === "visible" && refresh(), POLL_MS);
    const wake = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    return () => {
      clearInterval(tick);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
    };
  }, [refresh]);

  return { data, at, refresh };
}
