"use client";

import { useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Waveform } from "@/components/ui/Waveform";
import type { Nudge } from "@/lib/types";
import { speak, pauseSpeech, resumeSpeech, stopSpeech } from "@/lib/speech";

const STYLE: Record<Nudge["priority"], { chip: string; label: string; border: string; icon: IconName; bgColor: string }> = {
  see_doctor_soon: { chip: "tone-bad", label: "See a doctor soon", border: "border-l-play", icon: "siren", bgColor: "bg-bad-soft" },
  due: { chip: "tone-warn", label: "Screening due", border: "border-l-play", icon: "clock", bgColor: "bg-warn-soft" },
  ask_doctor: { chip: "tone-info", label: "Ask your doctor", border: "border-l-info", icon: "help", bgColor: "bg-info-soft" },
};

const RANK: Nudge["priority"][] = ["see_doctor_soon", "due", "ask_doctor"];

const unique = <T,>(items: T[], key: (t: T) => string) => {
  const seen = new Set<string>();
  return items.filter((i) => !seen.has(key(i)) && seen.add(key(i)));
};

/** One card for all nudges: top-priority headline, every reason, de-duplicated actions and sources. The one focal element on the page. */
export function NudgeCard({ nudges, language, showPlain }: { nudges: Nudge[]; language: string; showPlain: boolean }) {
  const sorted = [...nudges].sort((a, b) => RANK.indexOf(a.priority) - RANK.indexOf(b.priority));
  const top = sorted[0];
  const s = STYLE[top.priority];
  const view = sorted.map((n) => {
    const p = showPlain ? n.plain : undefined;
    return { n, plain: p, headline: p?.headline ?? n.title, why: p?.why ?? n.reason, todo: p?.whatToDo ?? n.action };
  });
  const headline = view[0].headline;
  const reasons = unique(view.map((v) => v.why), (x) => x);
  const actions = unique(view.map((v) => v.todo), (x) => x);
  const sources = unique(sorted.map((n) => n.source), (x) => x.url + x.quote);
  const anyPlain = view.some((v) => v.plain);
  const [playing, setPlaying] = useState(false);

  const handlePlay = () => {
    speak(`${headline}. ${reasons.join(". ")}. ${actions.join(". ")}`, language);
    setPlaying(true);
  };
  const handlePause = () => {
    pauseSpeech();
    setPlaying(false);
  };
  const handleResume = () => {
    resumeSpeech();
    setPlaying(true);
  };
  const handleStop = () => {
    stopSpeech();
    setPlaying(false);
  };

  return (
    <article className={`card border-l-4 ${s.border} ${s.bgColor} space-y-4`}>
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-surface text-accent-text shadow-sm">
          <Icon name={s.icon} className="h-8 w-8" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className={`chip ${s.chip}`}>{s.label}</span>
            {anyPlain && <span className="chip tone-accent text-xs">AI-reworded</span>}
          </div>
          <h3 className="font-display text-2xl leading-tight font-bold text-ink">{headline}</h3>
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-line bg-surface p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-accent-text"><Icon name="help" className="h-4 w-4" /> Why you&apos;re seeing this</p>
        {reasons.length === 1 ? (
          <p className="text-ink">{reasons[0]}</p>
        ) : (
          <ul className="list-disc space-y-2 pl-5 text-ink">
            {reasons.map((r) => <li key={r}>{r}</li>)}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-accent-text">What to do next</p>
        {actions.length === 1 ? (
          <p className="text-ink">{actions[0]}</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-ink">
            {actions.map((a) => <li key={a}>{a}</li>)}
          </ul>
        )}
      </div>

      <div className="space-y-3 rounded-xl border border-line bg-surface p-3 text-sm">
        <p className="text-xs font-semibold tracking-wide text-accent-text uppercase">{sources.length > 1 ? "Sources" : "Source"}</p>
        {sources.map((src) => (
          <div key={src.url + src.quote} className="space-y-1">
            <a href={src.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 font-semibold text-accent-text hover:underline">
              {src.name}
              <Icon name="external" className="h-3.5 w-3.5" />
            </a>
            <p className="text-muted italic">&quot;{src.quote}&quot;</p>
          </div>
        ))}
      </div>

      {/* Fixed safety wording, in the high-contrast urgent colours of both themes. */}
      <div className="urgent flex items-start gap-2 !p-3 !text-sm !font-normal">
        <Icon name="alert" className="mt-0.5 h-4 w-4" />
        <span><span className="font-bold">Not a diagnosis.</span> CareNudge flags based on guidelines; a doctor confirms what you need.</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {!playing ? (
          <button className="btn-secondary" onClick={handlePlay}><Icon name="volume" className="h-5 w-5" /> Read aloud</button>
        ) : (
          <>
            <Waveform active />
            <button className="btn-secondary" onClick={handlePause}><Icon name="pause" className="h-5 w-5" /> Pause</button>
            <button className="btn-secondary" onClick={handleResume}><Icon name="play" className="h-5 w-5" /> Resume</button>
            <button className="btn-secondary" onClick={handleStop}><Icon name="stop" className="h-5 w-5" /> Stop</button>
          </>
        )}
      </div>

      {anyPlain && (
        <details className="text-xs text-faint">
          <summary className="cursor-pointer font-semibold hover:text-muted">Show original rule wording</summary>
          {sorted.map((n) => (
            <p key={n.ruleId} className="mt-2 rounded-lg border border-line bg-surface p-3">{n.title} — {n.reason} {n.action}</p>
          ))}
        </details>
      )}
    </article>
  );
}
