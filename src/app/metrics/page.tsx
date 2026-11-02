"use client";

import { useState } from "react";
import { useStore } from "@/lib/storage";
import { Icon } from "@/components/ui/Icon";

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");

export default function MetricsPage() {
  const store = useStore();
  const [baseline, setBaseline] = useState("");
  const tb = store?.teachBack ?? [];
  const prep = store?.prep ?? [];

  const both = tb.filter((r) => r.whyCorrect && r.actionCorrect).length;
  const why = tb.filter((r) => r.whyCorrect).length;
  const action = tb.filter((r) => r.actionCorrect).length;
  const avgPrep = prep.length ? Math.round(prep.reduce((a, p) => a + p.seconds, 0) / prep.length) : null;
  const base = Number(baseline);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Prototype test results</h1>
        <p className="text-sm text-muted">Collected in this browser during demo sessions. Not real-world outcomes.</p>
      </div>

      <section className="card">
        <p className="text-sm font-semibold text-muted">Primary metric</p>
        <h2 className="text-lg font-bold">Testers who correctly said why a nudge appeared AND what to do</h2>
        <p className="mt-3 text-5xl font-bold text-accent-text">{pct(both, tb.length)}</p>
        <p className="mt-1 text-sm text-muted">{both} of {tb.length} teach-back responses</p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-raised p-3">
            <p className="text-muted">Got the “why” right</p>
            <p className="text-xl font-bold">{pct(why, tb.length)}</p>
          </div>
          <div className="rounded-lg bg-raised p-3">
            <p className="text-muted">Got the “what to do” right</p>
            <p className="text-xl font-bold">{pct(action, tb.length)}</p>
          </div>
        </div>
        {tb.length > 0 && (
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted"><th className="py-1">When</th><th>Rule</th><th>Why</th><th>Action</th></tr>
            </thead>
            <tbody>
              {tb.map((r, i) => (
                <tr key={i} className="border-b border-line">
                  <td className="py-1 text-xs">{new Date(r.at).toLocaleString()}</td>
                  <td className="font-mono text-xs">{r.ruleId}</td>
                  <td>{r.whyCorrect ? <span className="text-ok"><Icon name="check" className="h-4 w-4" /><span className="sr-only">correct</span></span> : <span className="text-bad"><Icon name="x" className="h-4 w-4" /><span className="sr-only">incorrect</span></span>}</td>
                  <td>{r.actionCorrect ? <span className="text-ok"><Icon name="check" className="h-4 w-4" /><span className="sr-only">correct</span></span> : <span className="text-bad"><Icon name="x" className="h-4 w-4" /><span className="sr-only">incorrect</span></span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <p className="text-sm font-semibold text-muted">Secondary metric</p>
        <h2 className="text-lg font-bold">Doctor prep time</h2>
        <p className="mt-1 text-sm text-muted">Time from opening a shared case to first saving findings or a plan.</p>
        <p className="mt-3 text-4xl font-bold text-accent-text">{avgPrep !== null ? `${avgPrep}s` : "—"}</p>
        <p className="text-sm text-muted">average over {prep.length} review(s)</p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="label" htmlFor="baseline">Baseline: seconds to take the same history manually</label>
            <input id="baseline" className="input w-40" type="number" value={baseline} onChange={(e) => setBaseline(e.target.value)} placeholder="from your doctor interview" />
          </div>
          {avgPrep !== null && base > 0 && (
            <p className="text-sm font-semibold">
              {base > avgPrep ? `${Math.round(((base - avgPrep) / base) * 100)}% less prep time` : "No time saved vs baseline"}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
