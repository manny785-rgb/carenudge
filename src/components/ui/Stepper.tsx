import { Icon } from "./Icon";

/**
 * A progress stepper. Done steps turn green with a tick, the current step is the vivid accent with a
 * coral underline, and a bar fills smoothly as you move on (it stops animating for reduced motion).
 */
export function Stepper({ labels, current }: { labels: string[]; current: number }) {
  const pct = labels.length > 1 ? (current / (labels.length - 1)) * 100 : 100;
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-muted">Step {current + 1} of {labels.length}</p>
      <div className="h-1.5 overflow-hidden rounded-full bg-raised" role="progressbar" aria-valuemin={1} aria-valuemax={labels.length} aria-valuenow={current + 1}>
        <div className="h-full rounded-full bg-play transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
      </div>
      <ol className="flex gap-2">
        {labels.map((label, i) => {
          const done = i < current;
          const now = i === current;
          return (
            <li key={label} className="flex-1" aria-current={now ? "step" : undefined}>
              <div
                className={`flex h-12 items-center justify-center rounded-xl text-lg font-semibold transition duration-300 ${
                  now ? "bg-accent text-accent-ink shadow-md" : done ? "bg-ok text-accent-ink" : "bg-raised text-faint"
                }`}
              >
                {done ? <Icon name="check" className="h-5 w-5" strokeWidth={3} /> : <span>{i + 1}</span>}
              </div>
              <p className={`mt-1 text-center text-xs font-medium ${now ? "text-ink" : "text-muted"}`}>{label}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
