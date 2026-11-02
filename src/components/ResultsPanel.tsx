"use client";

import { useState } from "react";
import { TrendChart } from "@/components/TrendChart";
import { toJpegBase64 } from "@/lib/image";
import { sgToday } from "@/lib/sgtime";
import type { TestResult } from "@/lib/types";

interface Draft {
  key: number;
  test: string;
  value: string;
  unit: string;
  date: string;
  rangeLow: string;
  rangeHigh: string;
}

const num = (s: string) => (s.trim() === "" || isNaN(Number(s)) ? null : Number(s));

/** Doctor enters (or confirms an AI draft of) lab values, then sees a trend per test. */
export function ResultsPanel({ shareId, initial, onChange }: { shareId: string; initial: TestResult[]; onChange?: (r: TestResult[]) => void }) {
  const [results, setResultsState] = useState<TestResult[]>(initial);
  // Tell the parent too, so values survive switching tabs.
  const setResults = (next: TestResult[] | ((r: TestResult[]) => TestResult[])) => setResultsState((r) => { const n = typeof next === "function" ? next(r) : next; onChange?.(n); return n; });
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [note, setNote] = useState("");
  const [reading, setReading] = useState(false);

  const blank = (over: Partial<Draft> = {}): Draft => ({ key: Date.now() + Math.random(), test: "", value: "", unit: "", date: sgToday(), rangeLow: "", rangeHigh: "", ...over });
  const patch = (key: number, p: Partial<Draft>) => setDrafts((d) => d.map((x) => (x.key === key ? { ...x, ...p } : x)));

  const readReport = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    setNote("");
    try {
      const imageBase64 = await toJpegBase64(file);
      const res = await fetch("/api/extract-results", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageBase64, mediaType: "image/jpeg" }) });
      const data = await res.json();
      if (!res.ok) return setNote(data.error ?? "Couldn't read that report.");
      setDrafts((d) => [
        ...d,
        ...data.draft.map((r: { test: string; value: number; unit: string; date: string; rangeLow: number | null; rangeHigh: number | null }) =>
          blank({ test: r.test, value: String(r.value), unit: r.unit, date: r.date || sgToday(), rangeLow: r.rangeLow === null ? "" : String(r.rangeLow), rangeHigh: r.rangeHigh === null ? "" : String(r.rangeHigh) }),
        ),
      ]);
      setNote("Draft read from the report. Check every value, then confirm each one. Nothing is saved until you confirm.");
    } catch {
      setNote("Couldn't process that image. Enter the values by hand instead.");
    } finally {
      setReading(false);
    }
  };

  const confirm = async (d: Draft) => {
    const value = num(d.value);
    if (!d.test.trim() || value === null || !d.date) return setNote("Each value needs a test name, a number and a date.");
    const res = await fetch("/api/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shareId, result: { test: d.test, value, unit: d.unit, date: d.date, rangeLow: num(d.rangeLow), rangeHigh: num(d.rangeHigh) } }),
    });
    const data = await res.json();
    if (!res.ok) return setNote(data.error ?? "Couldn't save.");
    setResults((r) => [...r, data.result]);
    setDrafts((x) => x.filter((y) => y.key !== d.key));
    setNote("Saved as doctor-confirmed.");
  };

  const remove = async (r: TestResult) => {
    await fetch(`/api/results?shareId=${encodeURIComponent(shareId)}&id=${encodeURIComponent(r.id)}`, { method: "DELETE" });
    setResults((x) => x.filter((y) => y.id !== r.id));
  };

  const byTest = results.reduce<Record<string, TestResult[]>>((acc, r) => ((acc[r.test] ??= []).push(r), acc), {});

  return (
    <div className="card space-y-4">
      <h3 className="font-bold">Test results</h3>

      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary py-2 text-sm" onClick={() => setDrafts((d) => [...d, blank()])}>Add a value</button>
        <label className="btn-secondary cursor-pointer py-2 text-sm">
          {reading ? "Reading…" : "Read from a report photo (AI draft)"}
          <input type="file" accept="image/*" className="hidden" disabled={reading} onChange={(e) => readReport(e.target.files?.[0])} />
        </label>
      </div>
      <p className="text-xs text-muted">A report photo is sent to the AI service to read the values. You confirm or edit every value before it is saved.</p>
      {note && <p className="text-sm text-accent-text">{note}</p>}

      {drafts.map((d) => (
        <div key={d.key} className="grid gap-2 rounded-lg border border-dashed border-line-strong p-3 sm:grid-cols-6">
          <input aria-label="Test" className="input sm:col-span-2" placeholder="Test (e.g. HbA1c)" value={d.test} onChange={(e) => patch(d.key, { test: e.target.value })} />
          <input aria-label="Value" className="input" inputMode="decimal" placeholder="Value" value={d.value} onChange={(e) => patch(d.key, { value: e.target.value })} />
          <input aria-label="Unit" className="input" placeholder="Unit" value={d.unit} onChange={(e) => patch(d.key, { unit: e.target.value })} />
          <input aria-label="Date" type="date" className="input sm:col-span-2" value={d.date} onChange={(e) => patch(d.key, { date: e.target.value })} />
          <input aria-label="Printed range low" className="input" inputMode="decimal" placeholder="Printed low" value={d.rangeLow} onChange={(e) => patch(d.key, { rangeLow: e.target.value })} />
          <input aria-label="Printed range high" className="input" inputMode="decimal" placeholder="Printed high" value={d.rangeHigh} onChange={(e) => patch(d.key, { rangeHigh: e.target.value })} />
          <div className="flex gap-2 sm:col-span-4">
            <button className="btn-primary py-2 text-sm" onClick={() => confirm(d)}>Confirm &amp; save</button>
            <button className="btn-secondary py-2 text-sm" onClick={() => setDrafts((x) => x.filter((y) => y.key !== d.key))}>Discard</button>
          </div>
        </div>
      ))}

      {Object.keys(byTest).length === 0 && drafts.length === 0 && <p className="text-sm text-muted">No results yet.</p>}

      {Object.entries(byTest).map(([test, rs]) => (
        <div key={test} className="space-y-2">
          <TrendChart results={rs} />
          <ul className="text-sm">
            {[...rs].sort((a, b) => b.date.localeCompare(a.date)).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 border-b border-line py-1">
                <span>{r.date}: <b>{r.value} {r.unit}</b></span>
                <span className={`chip ${r.source === "doctor-confirmed" ? "bg-ok-soft text-ok" : "bg-raised text-muted"}`}>{r.source}</span>
                {r.source === "doctor-confirmed" && <button className="text-xs text-bad underline" onClick={() => remove(r)}>Remove</button>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
