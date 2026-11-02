"use client";

import { useEffect, useState } from "react";
import { sgToday } from "@/lib/sgtime";
import type { Report, TestResult } from "@/lib/types";

/** A value read from a report by the AI, waiting for the doctor to check it. Never saved until confirmed. */
interface Draft {
  key: number;
  test: string;
  value: string;
  unit: string;
  date: string;
  rangeLow: number | null;
  rangeHigh: number | null;
}

/** Original file as a temporary browser URL. Revoked when the viewer closes. */
function useFileUrl(r: Report | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!r) return;
    const bytes = Uint8Array.from(atob(r.content), (ch) => ch.charCodeAt(0));
    const u = URL.createObjectURL(new Blob([bytes], { type: r.mimeType }));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(u);
    return () => {
      URL.revokeObjectURL(u);
      setUrl(null);
    };
  }, [r]);
  return r ? url : null;
}

/**
 * The doctor's Reports tab. It lists only the documents the patient chose to share (the server never
 * sends the others, so there is nothing to hide here), with a viewer for the original file and
 * any values read from it. Values stay "needs doctor confirmation" until the doctor confirms them.
 */
export function ReportsTab({ shareId, reports, results, onSaved }: { shareId: string; reports: Report[]; results: TestResult[]; onSaved: (r: TestResult) => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = reports.find((r) => r.id === openId) ?? null;
  const url = useFileUrl(open);
  const [drafts, setDrafts] = useState<Record<string, Draft[]>>({});
  const [note, setNote] = useState("");
  const [reading, setReading] = useState(false);

  const readValues = async (r: Report) => {
    setReading(true);
    setNote("");
    const res = await fetch("/api/extract-results", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageBase64: r.content, mediaType: r.mimeType }) });
    const data = await res.json().catch(() => ({}));
    setReading(false);
    if (!res.ok) return setNote(data.error ?? "Couldn't read that report.");
    setDrafts((d) => ({
      ...d,
      [r.id]: data.draft.map((x: { test: string; value: number; unit: string; date: string; rangeLow: number | null; rangeHigh: number | null }, i: number) => ({ key: i, ...x, value: String(x.value), date: x.date || sgToday() })),
    }));
    setNote("Draft read from the report. Check each value against the original, then confirm it.");
  };

  const confirm = async (r: Report, d: Draft) => {
    const value = Number(d.value);
    if (!d.test.trim() || d.value.trim() === "" || isNaN(value)) return setNote("Each value needs a test name and a number.");
    const res = await fetch("/api/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shareId, result: { test: d.test, value, unit: d.unit, date: d.date, rangeLow: d.rangeLow, rangeHigh: d.rangeHigh, reportId: r.id } }),
    });
    const data = await res.json();
    if (!res.ok) return setNote(data.error ?? "Couldn't save.");
    onSaved(data.result);
    setDrafts((all) => ({ ...all, [r.id]: (all[r.id] ?? []).filter((x) => x.key !== d.key) }));
    setNote("Saved as doctor-confirmed.");
  };

  if (reports.length === 0) {
    return <p className="card text-muted">No reports shared yet.</p>;
  }

  return (
    <div className="space-y-3">
      {note && <p className="text-sm text-accent-text">{note}</p>}
      {reports.map((r) => {
        const confirmed = results.filter((x) => x.reportId === r.id);
        const pending = drafts[r.id] ?? [];
        return (
          <div key={r.id} className="card space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{r.filename}</p>
                <p className="text-xs text-muted">
                  {r.kind === "lab" ? "Lab report" : "Other document"} · {r.clinic ? `${r.clinic} · ` : ""}uploaded {new Date(r.uploadedAt).toLocaleDateString()} · shared by the patient
                </p>
              </div>
              <div className="flex gap-2">
                <button className="btn-secondary py-1 text-sm" onClick={() => setOpenId(openId === r.id ? null : r.id)}>{openId === r.id ? "Close" : "View original"}</button>
                {r.mimeType !== "application/pdf" && (
                  <button className="btn-secondary py-1 text-sm" disabled={reading} onClick={() => readValues(r)}>{reading ? "Reading…" : "Read values (AI draft)"}</button>
                )}
              </div>
            </div>

            {openId === r.id && url && (
              r.mimeType === "application/pdf" ? (
                <iframe title={r.filename} src={url} className="h-[32rem] w-full rounded border border-line-strong" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt={r.filename} src={url} className="max-h-[32rem] w-full rounded border border-line-strong object-contain" />
              )
            )}

            {(confirmed.length > 0 || pending.length > 0) && (
              <ul className="text-sm">
                {confirmed.map((x) => (
                  <li key={x.id} className="flex flex-wrap items-center gap-2 border-b border-line py-1">
                    {x.test}: <b>{x.value} {x.unit}</b> ({x.date})
                    <span className="chip bg-ok-soft text-ok">confirmed by doctor</span>
                  </li>
                ))}
                {pending.map((d) => (
                  <li key={d.key} className="flex flex-wrap items-center gap-2 border-b border-dashed border-line-strong py-1">
                    <input aria-label="Test" className="input w-36 py-1" value={d.test} onChange={(e) => setDrafts((all) => ({ ...all, [r.id]: pending.map((x) => (x.key === d.key ? { ...x, test: e.target.value } : x)) }))} />
                    <input aria-label="Value" className="input w-20 py-1" inputMode="decimal" value={d.value} onChange={(e) => setDrafts((all) => ({ ...all, [r.id]: pending.map((x) => (x.key === d.key ? { ...x, value: e.target.value } : x)) }))} />
                    <input aria-label="Unit" className="input w-20 py-1" value={d.unit} onChange={(e) => setDrafts((all) => ({ ...all, [r.id]: pending.map((x) => (x.key === d.key ? { ...x, unit: e.target.value } : x)) }))} />
                    <span className="chip bg-warn-soft text-warn">needs doctor confirmation</span>
                    <button className="btn-primary py-1 text-sm" onClick={() => confirm(r, d)}>Confirm</button>
                    <button className="btn-secondary py-1 text-sm" onClick={() => setDrafts((all) => ({ ...all, [r.id]: pending.filter((x) => x.key !== d.key) }))}>Discard</button>
                  </li>
                ))}
              </ul>
            )}
            {r.mimeType === "application/pdf" && <p className="text-xs text-muted">PDFs can&apos;t be read automatically. Add values by hand under Test results.</p>}
          </div>
        );
      })}
    </div>
  );
}
