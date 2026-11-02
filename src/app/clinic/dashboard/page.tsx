"use client";

import { useCallback } from "react";
import { LiveStamp } from "@/components/LiveStamp";
import { useLive } from "@/lib/useLive";

interface Dash {
  today: string;
  bookedAndShared: number;
  nudgedAndShared: number;
  followUps: { total: number; done: number; overdue: number; dueThisWeek: number; upcoming: number };
  noShows: number;
  prep: { n: number; avgSeconds: number | null };
  teachBack: { n: number; bothCorrect: number };
}

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");
const mins = (s: number | null) => (s === null ? "—" : s < 90 ? `${s} sec` : `${(s / 60).toFixed(1)} min`);

function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="card">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className="font-display text-4xl font-bold text-accent-text">{value}</p>
      {note && <p className="text-xs text-faint">{note}</p>}
    </div>
  );
}

// Everything comes from this clinic's own consented shares. Counts only: no benchmarks, no revenue.
export default function DashboardPage() {
  // Fresh every 12 seconds and when the tab is shown. A failed read keeps the numbers on screen.
  const fetchDash = useCallback(async () => {
    const res = await fetch("/api/dashboard", { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as Dash;
  }, []);
  const { data: d, at } = useLive(fetchDash);

  if (!d) return <p className="text-faint">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold text-accent-text">Clinic dashboard</h1>
        <p className="rounded-lg border border-warn-line bg-warn-soft px-3 py-2 text-sm font-semibold text-warn">Demo data - not real clinic results.</p>
        <p className="text-sm text-muted">Counts from your clinic&apos;s patients who booked and agreed to share. Today is {d.today} (Singapore). <LiveStamp at={at} /></p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Patients who booked and shared" value={d.bookedAndShared} />
        <Stat label="…of whom had at least one nudge" value={d.nudgedAndShared} />
        <Stat label="Follow-ups done" value={d.followUps.done} note={`of ${d.followUps.total} follow-ups (${pct(d.followUps.done, d.followUps.total)})`} />
        <Stat label="Follow-ups overdue" value={d.followUps.overdue} note={`${d.followUps.dueThisWeek} due this week, ${d.followUps.upcoming} upcoming`} />
        <Stat label="No-shows" value={d.noShows} note="Follow-ups marked missed" />
        <Stat label="Average brief-prep time" value={mins(d.prep.avgSeconds)} note={d.prep.n ? `from ${d.prep.n} patient${d.prep.n === 1 ? "" : "s"}` : "No data yet"} />
        <Stat
          label="Teach-back: understood why and what to do"
          value={pct(d.teachBack.bothCorrect, d.teachBack.n)}
          note={d.teachBack.n ? `${d.teachBack.bothCorrect} of ${d.teachBack.n} answers from these patients` : "No answers yet"}
        />
      </div>
    </div>
  );
}
