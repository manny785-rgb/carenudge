import type { TestResult } from "@/lib/types";

/**
 * Small trend chart for one test (inline SVG, no chart library). The shaded band is the range
 * printed on the report, taken from the data and never computed here. It is not a diagnosis.
 */
export function TrendChart({ results }: { results: TestResult[] }) {
  const pts = [...results].sort((a, b) => a.date.localeCompare(b.date));
  if (!pts.length) return null;
  const last = pts[pts.length - 1];
  const W = 320, H = 130, PAD = 28;

  const lo = last.rangeLow, hi = last.rangeHigh;
  const values = [...pts.map((p) => p.value), ...(lo !== null ? [lo] : []), ...(hi !== null ? [hi] : [])];
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - PAD * 2);
  const t0 = new Date(pts[0].date).getTime(), t1 = new Date(last.date).getTime();
  const x = (d: string) => (t1 === t0 ? W / 2 : PAD + ((new Date(d).getTime() - t0) / (t1 - t0)) * (W - PAD * 2));

  return (
    <figure className="space-y-1">
      <figcaption className="text-sm font-semibold">{last.test} ({last.unit})</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-sm" role="img" aria-label={`${last.test} over time: ${pts.map((p) => `${p.value} ${p.unit} on ${p.date}`).join(", ")}`}>
        {lo !== null && hi !== null && <rect x={PAD} y={y(hi)} width={W - PAD * 2} height={Math.max(2, y(lo) - y(hi))} className="fill-accent" opacity="0.14" />}
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} className="stroke-line-strong" />
        {pts.length > 1 && <polyline fill="none" className="stroke-accent" strokeWidth="2" points={pts.map((p) => `${x(p.date)},${y(p.value)}`).join(" ")} />}
        {pts.map((p) => (
          <g key={p.id}>
            <circle cx={x(p.date)} cy={y(p.value)} r="5" className={`stroke-accent ${p.source === "doctor-confirmed" ? "fill-accent" : "fill-surface"}`} strokeWidth="2" />
            <text x={x(p.date)} y={y(p.value) - 9} textAnchor="middle" fontSize="10" className="fill-ink">{p.value}</text>
            <text x={x(p.date)} y={H - 10} textAnchor="middle" fontSize="9" className="fill-muted">{p.date.slice(2)}</text>
          </g>
        ))}
      </svg>
      <p className="text-xs text-muted">
        {lo !== null && hi !== null ? `Shaded: range printed on the report (${lo} to ${hi} ${last.unit}). ` : "No printed range was entered. "}
        Filled dot = doctor-confirmed, hollow dot = patient-reported. This chart is not a diagnosis.
      </p>
    </figure>
  );
}
