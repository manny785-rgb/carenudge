"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { LiveStamp } from "@/components/LiveStamp";
import { useLive } from "@/lib/useLive";
import { bmiOf, lastTestLabel } from "@/lib/rules/engine";
import { ReportsTab } from "@/components/ReportsTab";
import { ResultsPanel } from "@/components/ResultsPanel";
import { newId, recordPrep } from "@/lib/storage";
import type { CareCase, DoctorFindings, FollowUp, FollowUpStatus, TestResult } from "@/lib/types";
import { Icon } from "@/components/ui/Icon";

const secondsSince = (start: number) => Math.round((Date.now() - start) / 1000);
const today = () => new Date().toISOString().slice(0, 10);

function effectiveStatus(f: FollowUp): FollowUpStatus | "overdue" {
  return (f.status === "planned" || f.status === "booked") && f.dueDate < today() ? "overdue" : f.status;
}

const STATUS_STYLE: Record<string, string> = {
  planned: "bg-raised text-muted",
  booked: "bg-info-soft text-info",
  done: "bg-ok-soft text-ok",
  missed: "bg-bad-soft text-bad",
  overdue: "bg-bad-soft text-bad",
};

const PLAN_TEMPLATES = ["HbA1c", "Fasting plasma glucose", "Oral glucose tolerance test", "Repeat diabetes screening", "Review visit"];

interface RequestDetail {
  id: string;
  patientName: string;
  appointmentDate: string;
  updatedAt?: string;
  snapshot: CareCase;
}

// The patient summary comes from the server, which only returns requests for this doctor's clinic.
export default function DoctorPage() {
  return (
    <Suspense fallback={<p className="text-faint">Loading…</p>}>
      <Patient />
    </Suspense>
  );
}

function Patient() {
  const params = useSearchParams();
  const id = params.get("id");
  const router = useRouter();
  const [req, setReq] = useState<RequestDetail | null>(null);
  const [error, setError] = useState("");
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    // Opened without a request (typed address, old tab): go to the list.
    if (!id) return router.replace("/requests");
    fetch(`/api/requests?id=${encodeURIComponent(id)}`, { cache: "no-store" })
      .then(async (r) => (r.ok ? setReq((await r.json()).request) : setError("This request isn't available. It may have been revoked or expired.")))
      .catch(() => setError("Couldn't load this request."));
  }, [id, router]);

  // While the page is open, check for patient changes every 12 seconds (poll=1: not logged as another open).
  // Changes are offered with a banner instead of replacing the form, so the doctor's unsaved edits are never lost.
  const fetchLatest = useCallback(async () => {
    if (!id) return null;
    const r = await fetch(`/api/requests?id=${encodeURIComponent(id)}&poll=1`, { cache: "no-store" });
    if (r.status === 404) return { gone: true as const };
    return r.ok ? { gone: false as const, request: (await r.json()).request as RequestDetail } : null;
  }, [id]);
  const { data: latest, at } = useLive(fetchLatest);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (latest?.gone && req) setEnded(true);
  }, [latest, req]);
  const hasNew = !!latest && !latest.gone && !!req && !!latest.request.updatedAt && latest.request.updatedAt !== req.updatedAt;
  const showChanges = async () => {
    const r = await fetch(`/api/requests?id=${encodeURIComponent(id!)}&ack=1`, { cache: "no-store" });
    if (r.ok) setReq((await r.json()).request);
  };

  return (
    <div className="space-y-6">
      <Link href="/requests" className="text-sm text-accent-text underline">← Patient requests</Link>
      {error && <p className="card text-muted">{error}</p>}
      {ended && (
        <p className="rounded-lg border border-warn-line bg-warn-soft p-3 text-sm text-warn">
          Access has ended: the patient stopped sharing, the appointment was cancelled, or consent expired. This page no longer shows their data.
        </p>
      )}
      {req && !ended && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <LiveStamp at={at} />
          {hasNew && (
            <span className="flex items-center gap-2 rounded-lg bg-bad-soft px-3 py-1 text-sm text-bad">
              <b>New changes</b> from the patient
              <button className="btn-secondary py-1 text-xs" onClick={showChanges}>Show changes</button>
            </span>
          )}
        </div>
      )}
      {req && !ended && <CaseDetail key={`${req.id}-${req.updatedAt ?? ""}`} requestId={req.id} appointmentDate={req.appointmentDate} c={req.snapshot} startTab={params.get("tab") === "reports" ? "reports" : "summary"} />}
    </div>
  );
}

function CaseDetail({ requestId, appointmentDate, c, startTab }: { requestId: string; appointmentDate: string; c: CareCase; startTab: "summary" | "reports" }) {
  const s = c.summary;
  const [findings, setFindings] = useState<DoctorFindings>(c.findings);
  const [followUps, setFollowUps] = useState<FollowUp[]>(c.followUps);
  const [plan, setPlan] = useState({ test: PLAN_TEMPLATES[0], dueDate: "", where: "" });
  const [saved, setSaved] = useState("");
  const [tab, setTab] = useState<"summary" | "reports">(startTab);
  const [results, setResults] = useState<TestResult[]>(c.results ?? []);
  const reports = c.reports ?? [];
  const [openedAt] = useState(() => Date.now());
  const [prepLogged, setPrepLogged] = useState(Boolean(c.findings.reviewedAt));

  const save = async (nextFindings: DoctorFindings, nextFollowUps: FollowUp[], msg: string) => {
    const res = await fetch("/api/requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: requestId, findings: nextFindings, followUps: nextFollowUps }),
    });
    if (!res.ok) return setSaved("Couldn't save. This request may have been revoked.");
    setFindings(nextFindings);
    setFollowUps(nextFollowUps);
    if (!prepLogged) {
      recordPrep({ caseId: c.id, seconds: secondsSince(openedAt), at: new Date().toISOString() });
      setPrepLogged(true);
    }
    setSaved(msg);
  };

  const updateFollowUp = (id: string, patch: Partial<FollowUp>) =>
    save(findings, followUps.map((f) => (f.id === id ? { ...f, ...patch } : f)), "Follow-up updated.");

  return (
    <section className="space-y-4">
      <div className="flex gap-2" role="tablist">
        {([["summary", "Patient summary"], ["reports", `Reports (${reports.length})`]] as const).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "btn-primary py-2 text-sm" : "btn-secondary py-2 text-sm"} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {tab === "reports" ? (
        <ReportsTab shareId={requestId} reports={reports} results={results} onSaved={(r) => setResults((x) => [...x, r])} />
      ) : (
      <>
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold">{c.displayName}</h2>
          <Link href={`/doctor/brief?id=${encodeURIComponent(requestId)}`} className="btn-secondary py-2 text-sm">View brief</Link>
          <span className="text-xs text-muted">
            Appointment {appointmentDate} · confirmed by patient {c.confirmedAt ? new Date(c.confirmedAt).toLocaleDateString() : "—"} · history{" "}
            {c.parsedBy === "ai" ? "AI-structured" : "keyword-parsed"}
          </span>
        </div>
        <p className="mt-2 text-sm">
          Age {s.age ?? "—"} · {s.sex ?? "sex not stated"} · BMI {bmiOf(s) ?? "—"} · Last diabetes test: {lastTestLabel(s.lastDiabetesTest)}
          {s.gestationalDiabetes && " · history of gestational diabetes"}
          {s.onDiabetesTreatment && " · on diabetes treatment"}
        </p>
        {s.symptoms.length > 0 && <p className="mt-1 text-sm font-semibold text-bad">Reported symptoms: {s.symptoms.join(", ")}</p>}

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="mb-1 text-sm font-semibold text-muted">Family history</h3>
            <table className="w-full text-sm">
              <tbody>
                {s.relatives.map((r, i) => (
                  <tr key={i} className="border-b border-line">
                    <td className="py-1">{r.relation} <span className="text-xs text-faint">({r.degree === 1 ? "1st°" : "2nd°"})</span></td>
                    <td>{r.condition}</td>
                    <td className="text-right text-xs text-muted">{r.ageAtDiagnosis ? `dx ${r.ageAtDiagnosis}` : ""}</td>
                  </tr>
                ))}
                {!s.relatives.length && <tr><td className="text-faint">None reported</td></tr>}
              </tbody>
            </table>
          </div>
          <div>
            <h3 className="mb-1 text-sm font-semibold text-muted">Medications</h3>
            <ul className="text-sm">
              {s.medications.map((m, i) => (
                <li key={i}>{m.name} {m.purpose && <span className="text-muted">— {m.purpose}</span>}</li>
              ))}
              {!s.medications.length && <li className="text-faint">None reported</li>}
            </ul>
          </div>
        </div>

        <h3 className="mt-4 mb-1 text-sm font-semibold text-muted">Rules that fired</h3>
        <ul className="space-y-1 text-sm">
          {c.rules?.nudges.map((n) => (
            <li key={n.ruleId} className="rounded-lg bg-raised px-3 py-2">
              <span className="font-mono text-xs text-muted">{n.ruleId}</span> — {n.title}
              <span className="block text-xs text-muted">{n.reason}</span>
              <a href={n.source.url} target="_blank" rel="noreferrer" className="text-xs text-accent-text underline">
                Source: {n.source.name} <Icon name="external" className="inline h-3 w-3" />
              </a>
            </li>
          ))}
          {!c.rules?.nudges.length && <li className="text-muted">{c.rules?.noNudgeNotice}</li>}
        </ul>
      </div>

      <div className="card space-y-3">
        <h3 className="font-bold">Exam findings</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {([
            ["bpSys", "BP systolic"],
            ["bpDia", "BP diastolic"],
            ["bmi", "BMI (measured)"],
            ["hba1c", "HbA1c %"],
            ["fastingGlucose", "FPG mmol/L"],
          ] as const).map(([k, label]) => (
            <div key={k}>
              <label className="label text-xs" htmlFor={k}>{label}</label>
              <input id={k} className="input" inputMode="decimal" value={findings[k]} onChange={(e) => setFindings({ ...findings, [k]: e.target.value })} />
            </div>
          ))}
        </div>
        <textarea className="input" rows={2} placeholder="Clinical notes" value={findings.notes} onChange={(e) => setFindings({ ...findings, notes: e.target.value })} />
        <button className="btn-primary" onClick={() => save({ ...findings, reviewedAt: new Date().toISOString() }, followUps, "Findings saved.")}>
          Save findings
        </button>
      </div>

      <ResultsPanel shareId={requestId} initial={results} onChange={setResults} />

      <div className="card space-y-3">
        <h3 className="font-bold">Follow-ups</h3>
        {followUps.length === 0 && <p className="text-sm text-muted">No follow-ups yet.</p>}
        {followUps.map((f) => {
          const st = effectiveStatus(f);
          return (
            <div key={f.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line p-2 text-sm">
              <span className="min-w-40 flex-1">{f.test}{f.where && <span className="block text-xs text-muted">{f.where} · set by {f.createdBy}</span>}</span>
              <input aria-label="Due date" type="date" className="input w-auto py-1 text-xs" value={f.dueDate} onChange={(e) => e.target.value && updateFollowUp(f.id, { dueDate: e.target.value })} />
              <span className={`chip ${STATUS_STYLE[st]}`}>{st}</span>
              <select aria-label="Change status" className="rounded border border-line text-xs" value={f.status} onChange={(e) => updateFollowUp(f.id, { status: e.target.value as FollowUpStatus })}>
                {(["planned", "booked", "done", "missed"] as FollowUpStatus[]).map((x) => <option key={x}>{x}</option>)}
              </select>
              <input className="input w-40 py-1 text-xs" placeholder="e.g. HbA1c 5.9%" defaultValue={f.result} onBlur={(e) => e.target.value !== f.result && updateFollowUp(f.id, { result: e.target.value })} />
            </div>
          );
        })}

        <h4 className="pt-2 text-sm font-semibold text-muted">Set follow-up plan</h4>
        <div className="grid gap-2 sm:grid-cols-[1fr_10rem_1fr_auto]">
          <select className="input" value={plan.test} onChange={(e) => setPlan({ ...plan, test: e.target.value })}>
            {PLAN_TEMPLATES.map((t) => <option key={t}>{t}</option>)}
          </select>
          <input className="input" type="date" value={plan.dueDate} onChange={(e) => setPlan({ ...plan, dueDate: e.target.value })} />
          <input className="input" placeholder="Where (optional)" value={plan.where} onChange={(e) => setPlan({ ...plan, where: e.target.value })} />
          <button
            className="btn-primary"
            disabled={!plan.dueDate}
            onClick={() => {
              const f: FollowUp = { id: newId(), test: plan.test, dueDate: plan.dueDate, status: "planned", where: plan.where, result: "", createdBy: "doctor" };
              save(findings, [...followUps, f], "Follow-up added.");
              setPlan({ ...plan, dueDate: "", where: "" });
            }}
          >
            Add
          </button>
        </div>
        {saved && <p className="text-sm text-accent-text">{saved}</p>}
      </div>
      </>
      )}
    </section>
  );
}
