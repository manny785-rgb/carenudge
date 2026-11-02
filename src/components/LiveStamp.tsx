"use client";

import { useEffect, useState } from "react";

/** "Updated just now" / "Updated 3 min ago", re-evaluated every 15 seconds. */
export function LiveStamp({ at }: { at: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);
  if (at === null) return null;
  const mins = Math.floor((now - at) / 60_000);
  return <span className="text-xs text-faint" aria-live="polite">Updated {mins < 1 ? "just now" : `${mins} min ago`}</span>;
}
