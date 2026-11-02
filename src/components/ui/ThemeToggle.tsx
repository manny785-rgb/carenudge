"use client";

import { useSyncExternalStore } from "react";
import { applyChoice, readChoice, saveChoice, type ThemeChoice } from "@/lib/theme";
import { Icon, type IconName } from "./Icon";

const OPTIONS: { value: ThemeChoice; label: string; icon: IconName }[] = [
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" },
  { value: "system", label: "System", icon: "monitor" },
];

// A tiny external store so the toggle reads localStorage on the client only (no hydration mismatch)
// and every toggle on the page stays in step.
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  const mq = matchMedia("(prefers-color-scheme: dark)");
  // While following the system, react when the device switches theme.
  const onSystem = () => readChoice() === "system" && applyChoice("system");
  mq.addEventListener("change", onSystem);
  return () => {
    listeners.delete(cb);
    mq.removeEventListener("change", onSystem);
  };
};

/** Light / dark / system, as three buttons. Works on every page and for every role, signed in or not. */
export function ThemeToggle({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const choice = useSyncExternalStore(subscribe, readChoice, () => null);
  const set = (value: ThemeChoice) => {
    saveChoice(value);
    listeners.forEach((l) => l());
  };
  if (compact) {
    // One button that cycles light, dark, system. Used where there is no room for three (phone header, signed out).
    const i = OPTIONS.findIndex((o) => o.value === choice);
    const here = OPTIONS[i < 0 ? 2 : i];
    const next = OPTIONS[(OPTIONS.indexOf(here) + 1) % OPTIONS.length];
    return (
      <button type="button" aria-label={`Theme: ${here.label}. Switch to ${next.label}.`} title={`Theme: ${here.label}`} onClick={() => set(next.value)} className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line-strong bg-surface text-ink hover:bg-raised ${className}`}>
        <Icon name={here.icon} className="h-5 w-5" />
      </button>
    );
  }
  return (
    <div role="radiogroup" aria-label="Colour theme" className={`inline-flex rounded-xl border border-line-strong bg-surface p-1 ${className}`}>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={choice === o.value}
          aria-label={`${o.label} theme`}
          title={`${o.label} theme`}
          className={`inline-flex min-h-10 min-w-10 items-center justify-center gap-1 rounded-lg px-2 text-sm font-semibold transition ${
            choice === o.value ? "bg-accent text-accent-ink" : "text-muted hover:bg-raised"
          }`}
          onClick={() => set(o.value)}
        >
          <Icon name={o.icon} className="h-4 w-4" />
          <span className="sr-only sm:not-sr-only">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
