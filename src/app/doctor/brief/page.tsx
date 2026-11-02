"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { buildQuestions } from "@/lib/brief";
import { bmiOf, lastTestLabel } from "@/lib/rules/engine";
import type { CareCase } from "@/lib/types";

interface RequestDetail {
  id: string;
  patientName: string;
  appointmentDate: string;
  snapshot: CareCase;
}

/** One-page pre-visit brief, printable (see the @media print rules in globals.css). */
export default function BriefPage() {
  return (
    <Suspense fallback={<p className="text-faint">Loading…</p>}>
      <Brief />
    </Suspense>
  );
}

function Brief() {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const [req, setReq] = useState<RequestDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    // Opened without a request (typed address, old tab): go to the list, where each row has "View brief".
    if (!id) return router.replace("/requests");
    // view=brief makes the server record this open in the access log.
    fetch(`/api/requests?id=${encodeURIComponent(id)}&view=brief`, { cache: "no-store" })
      .then(async (r) => (r.ok ? setReq((await r.json()).request) : setError("This request isn't available. It may have been revoked or expired.")))
      .catch(() => setError("Couldn't load this brief."));
  }, [id, router]);

  if (error) return <p className="card text-muted">{error}</p>;
  if (!req) return <p className="text-faint">Loading…</p>;

  const c = req.snapshot;
  const s = c.summary;
  const meds = s.medications.filter((m) => m.forWhom === "me");
  const results = [...(c.results ?? [])].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <article className="mx-auto max-w-3xl space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Link href={`/doctor/patient?id=${encodeURIComponent(req.id)}`} className="text-sm text-accent-text underline">← Back to patient</Link>
        <button className="btn-primary" onClick={() => window.print()}>Print / Save as PDF</button>
      </div>

      <header className="card">
        <p className="text-xs font-semibold tracking-wide text-faint uppercase">Pre-visit brief</p>
        <h1 className="text-2xl font-bold">{req.patientName}</h1>
        <p className="text-sm">Appointment: {req.appointmentDate} · Age {s.age ?? "—"} · {s.sex ?? "sex not stated"} · BMI {bmiOf(s) ?? "—"}</p>
        {s.symptoms.length > 0 && <p className="mt-1 text-sm font-semibold text-bad">Symptoms the patient selected: {s.symptoms.join(", ")}</p>}
      </header>

      <section className="card">
        <h2 className="mb-2 font-bold">Family history (patient-confirmed)</h2>
        {s.relatives.length ? (
          <ul className="list-disc pl-5 text-sm">
            {s.relatives.map((r, i) => (
              <li key={i}>
                {r.relation} ({r.degree === 1 ? "1st" : "2nd"} degree): {r.condition}
                {r.ageAtDiagnosis ? `, diagnosed around ${r.ageAtDiagnosis}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">None reported</p>
        )}
      </section>

      <section className="card grid gap-4 sm:grid-cols-2">
        <div>
          <h2 className="mb-2 font-bold">Medicines (patient-confirmed)</h2>
          {meds.length ? (
            <ul className="list-disc pl-5 text-sm">
              {meds.map((m, i) => <li key={i}>{m.name}{m.purpose ? ` - ${m.purpose}` : ""}</li>)}
            </ul>
          ) : (
            <p className="text-sm text-muted">None reported</p>
          )}
        </div>
        <div>
          <h2 className="mb-2 font-bold">Last tests</h2>
          <p className="text-sm">Last diabetes test (patient-reported): {lastTestLabel(s.lastDiabetesTest)}</p>
          {results.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-sm">
              {results.map((r) => (
                <li key={r.id}>
                  {r.test}: {r.value} {r.unit} on {r.date} <span className="text-xs text-muted">({r.source})</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="card">
        <h2 className="mb-2 font-bold">Nudges raised</h2>
        <ul className="space-y-2 text-sm">
          {c.rules?.nudges.map((n) => (
            <li key={n.ruleId} className="rounded-lg bg-raised px-3 py-2">
              <span className="font-mono text-xs text-muted">{n.ruleId}</span> - {n.title}
              <span className="block text-xs text-muted">{n.reason}</span>
              <a href={n.source.url} target="_blank" rel="noreferrer" className="text-xs text-accent-text underline">
                Source: {n.source.name} ({n.source.url})
              </a>
            </li>
          ))}
          {!c.rules?.nudges.length && <li className="text-muted">{c.rules?.noNudgeNotice}</li>}
        </ul>
      </section>

      <section className="card">
        <h2 className="mb-2 font-bold">Questions to consider asking</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          {buildQuestions(c).map((q) => <li key={q}>{q}</li>)}
        </ol>
      </section>

      <p className="text-xs text-muted">
        Built from data the patient confirmed. CareNudge does not diagnose, does not give an all-clear, and the doctor decides everything. If the
        patient feels unwell, they should call 995 or go to A&amp;E.
      </p>
    </article>
  );
}
