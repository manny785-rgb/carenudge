"use client";

import { useState } from "react";
import { bmiOf, lastTestLabel } from "@/lib/rules/engine";
import { reportShareDefault, type CareCase, type Report } from "@/lib/types";

/** Shows exactly what a clinic will receive and asks for explicit consent before anything is sent. */
export function ShareConsent({
  c,
  clinicName,
  appointmentDate,
  onCancel,
  onConfirm,
}: {
  c: CareCase;
  clinicName: string;
  appointmentDate: string;
  onCancel: () => void;
  /** Called with the documents the patient ticked (possibly none). */
  onConfirm: (reports: Report[]) => Promise<void>;
}) {
  const s = c.summary;
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const ownMeds = s.medications.filter((m) => m.forWhom === "me");
  const docs = c.reports ?? [];
  // Lab reports start ticked and other documents unticked; the patient decides each one.
  const [ticked, setTicked] = useState<Set<string>>(() => new Set(docs.filter(reportShareDefault).map((r) => r.id)));
  const toggle = (id: string) => setTicked((t) => { const n = new Set(t); if (!n.delete(id)) n.add(id); return n; });

  return (
    <div className="space-y-3 rounded-lg border border-accent/30 bg-raised p-4 text-sm">
      <p className="font-semibold text-accent-text">What {clinicName} will see</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>Your name and appointment date ({appointmentDate})</li>
        <li>
          Age {s.age ?? "—"}, {s.sex ?? "sex not stated"}, BMI {bmiOf(s) ?? "—"}, last diabetes test: {lastTestLabel(s.lastDiabetesTest)}
          {s.gestationalDiabetes && ", history of gestational diabetes"}
        </li>
        <li>Symptoms: {s.symptoms.length ? s.symptoms.join(", ") : "none reported"}</li>
        <li>
          Family history: {s.relatives.length ? s.relatives.map((r) => `${r.relation} - ${r.condition}`).join("; ") : "none reported"}
        </li>
        <li>Your own medicines: {ownMeds.length ? ownMeds.map((m) => m.name).join(", ") : "none reported"}</li>
        <li>Your nudges and their sources: {c.rules?.nudges.map((n) => n.title).join("; ") || "none"}</li>
      </ul>
      <p className="text-muted">
        <b>Not shared:</b> the text you typed, medicines for people you care for, and any document you leave unticked below. You can stop sharing at any time.
      </p>
      <fieldset className="space-y-1">
        <legend className="font-semibold text-accent-text">Choose what to share</legend>
        {docs.length === 0 && <p className="text-muted">You haven&apos;t uploaded any documents. Add some on the Reports page; you can share them later.</p>}
        {docs.map((r) => (
          <label key={r.id} className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={ticked.has(r.id)} onChange={() => toggle(r.id)} />
            <span>{r.filename} <span className="text-xs text-muted">({r.kind === "lab" ? "lab report" : "other document"})</span></span>
          </label>
        ))}
      </fieldset>
      <label className="flex items-start gap-2 font-medium">
        <input type="checkbox" className="mt-1" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        I agree to share this with {clinicName}.
      </label>
      <div className="flex gap-2">
        <button
          className="btn-primary"
          disabled={!agreed || busy}
          onClick={async () => {
            setBusy(true);
            await onConfirm(docs.filter((r) => ticked.has(r.id)).map((r) => ({ ...r, shared: true })));
            setBusy(false);
          }}
        >
          {busy ? "Sharing…" : "Share with this clinic"}
        </button>
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
