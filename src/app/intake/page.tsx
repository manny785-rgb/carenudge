"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { NudgeCard } from "@/components/NudgeCard";
import { ShareConsent } from "@/components/ShareConsent";
import { useSession } from "@/components/Session";
import { CLINICS } from "@/lib/clinics";
import { openStatus, useNow } from "@/lib/hours";
import { UrgentCare } from "@/components/UrgentCare";
import { ClinicUpdates } from "@/components/ClinicUpdates";
import { PERSONAS } from "@/lib/personas";
import { SYMPTOM_OPTIONS, bmiOf, evaluate, lastTestLabel, teachBackOptions } from "@/lib/rules/engine";
import { LANGUAGES } from "@/lib/speech";
import { emptyFindings, getCase, newId, recordTeachBack, saveNow, upsertCase, useHydrated } from "@/lib/storage";
import type { CareCase, HealthSummary, LastTest, Medication, Relative } from "@/lib/types";
import { Icon } from "@/components/ui/Icon";
import { Stepper } from "@/components/ui/Stepper";
import { Tick } from "@/components/ui/Tick";

type Step = "consent" | "history" | "confirm" | "nudges";

const blankSummary = (): HealthSummary => ({
  age: null,
  sex: null,
  heightCm: null,
  weightKg: null,
  lastDiabetesTest: "unknown",
  gestationalDiabetes: null,
  symptoms: [],
  relatives: [],
  medications: [],
  onDiabetesTreatment: false,
  uncertain: [],
});

const newCase = (): CareCase => ({
  id: newId(),
  displayName: "",
  createdAt: new Date().toISOString(),
  consentAt: "",
  rawHistory: "",
  parsedBy: "ai",
  confirmedAt: null,
  summary: blankSummary(),
  rules: null,
  language: "English",
  sharedAt: null,
  findings: emptyFindings(),
  followUps: [],
  reports: [],
});

const DIABETES_MEDS = /metformin|insulin|gliclazide|sitagliptin|empagliflozin|dapagliflozin|glipizide|linagliptin/i;

export default function IntakePage() {
  // Needs localStorage and the URL, so render only on the client.
  return useHydrated() ? <Intake /> : null;
}

function Intake() {
  // Resume a saved case via ?case=<id>
  const [resumed] = useState(() => {
    const id = new URLSearchParams(window.location.search).get("case");
    return id ? getCase(id) : null;
  });
  const [step, setStep] = useState<Step>(resumed ? (resumed.rules ? "nudges" : "confirm") : "consent");
  const [c, setC] = useState<CareCase>(() => resumed ?? newCase());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { user } = useSession();

  const persist = (next: CareCase) => {
    setC(next);
    upsertCase(next);
  };

  const steps: Step[] = ["consent", "history", "confirm", "nudges"];

  // The finished check is already saved (see "My data"); this just opens a blank one.
  const restart = () => {
    setC(newCase());
    setStep("consent");
    setError("");
    window.history.replaceState(null, "", "/intake");
    window.scrollTo({ top: 0 });
  };

  const currentStepIndex = steps.indexOf(step);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/" className="inline-block text-sm text-accent-text underline">← Exit to home</Link>
      <Stepper labels={["Consent", "Your history", "Confirm", "Your nudges"]} current={currentStepIndex} />

      {error && <p className="rounded-lg bg-bad-soft p-3 text-sm text-bad">{error}</p>}

      {step === "consent" && (
        <Consent
          defaultName={user?.name ?? ""}
          onAccept={(name) => {
            setC({ ...c, displayName: name || "Me", consentAt: new Date().toISOString() });
            setStep("history");
          }}
        />
      )}

      {step === "history" && (
        <History
          c={c}
          setC={setC}
          busy={busy}
          onSubmit={async () => {
            setBusy(true);
            setError("");
            try {
              const res = await fetch("/api/structure", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: c.rawHistory }),
              });
              const out = await res.json();
              const meds: Medication[] = out.medications ?? [];
              persist({
                ...c,
                parsedBy: out.parsedBy,
                summary: {
                  ...c.summary,
                  relatives: out.relatives ?? [],
                  medications: meds,
                  gestationalDiabetes: c.summary.sex === "male" ? null : (out.gestationalDiabetes ?? null),
                  onDiabetesTreatment: meds.some((m) => m.forWhom === "me" && DIABETES_MEDS.test(m.name)),
                  uncertain: out.uncertain ?? [],
                },
              });
              setStep("confirm");
            } catch {
              setError("Couldn't reach the server. Check your connection and try again.");
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      {step === "confirm" && (
        <Confirm
          c={c}
          setC={setC}
          onBack={() => setStep("history")}
          onConfirm={() => {
            const confirmed = { ...c, confirmedAt: new Date().toISOString(), rules: evaluate(c.summary) };
            persist(confirmed);
            setStep("nudges");
          }}
        />
      )}

      {step === "nudges" && c.rules && <Nudges c={c} persist={persist} onRestart={restart} onEdit={() => setStep("confirm")} onEditHistory={() => setStep("history")} />}
    </div>
  );
}

function Consent({ onAccept, defaultName }: { onAccept: (name: string) => void; defaultName: string }) {
  const [ok, setOk] = useState(false);
  const [name, setName] = useState(defaultName);
  return (
    <section className="card space-y-4">
      <h1 className="text-2xl font-bold">Before we start</h1>
      <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
        <li>CareNudge <b>does not diagnose</b> and will <b>never tell you that you&apos;re fine</b>.</li>
        <li>Nudges come from fixed screening rules with cited sources. AI only tidies your text and rewords nudges.</li>
        <li>Your free-text history is sent to an AI service to be structured. Avoid names, NRIC or addresses.</li>
        <li>Your checks are saved to your account. A doctor sees one only if you book there and choose to share it, and you can delete it any time.</li>
        <li>Feeling unwell now? Don&apos;t use this — see a doctor. Emergency: call 995.</li>
      </ul>
      <div>
        <label className="label" htmlFor="nick">Nickname (optional, shown to your doctor)</label>
        <input id="nick" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mei Ling" />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={ok} onChange={(e) => setOk(e.target.checked)} />
        I understand and agree to my answers being processed as described.
      </label>
      <button className="btn-primary" disabled={!ok} onClick={() => onAccept(name.trim())}>
        Continue
      </button>
    </section>
  );
}

function num(v: string) {
  const n = Number(v);
  return v.trim() === "" || Number.isNaN(n) ? null : n;
}

function History({ c, setC, busy, onSubmit }: { c: CareCase; setC: (c: CareCase) => void; busy: boolean; onSubmit: () => void }) {
  const s = c.summary;
  const set = (patch: Partial<HealthSummary>) => setC({ ...c, summary: { ...s, ...patch } });
  const toggleSymptom = (x: string) =>
    set({ symptoms: s.symptoms.includes(x) ? s.symptoms.filter((y) => y !== x) : [...s.symptoms, x] });

  return (
    <section className="card space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">About you</h1>
        <select
          className="input w-auto"
          defaultValue=""
          aria-label="Load demo persona"
          onChange={(e) => {
            const p = PERSONAS.find((x) => x.key === e.target.value);
            if (p) setC({ ...c, displayName: c.displayName === "Me" ? p.displayName : c.displayName, rawHistory: p.rawHistory, summary: { ...s, ...p.base } });
          }}
        >
          <option value="" disabled>Load a demo persona…</option>
          {PERSONAS.map((p) => (
            <option key={p.key} value={p.key}>{p.displayName} — {p.blurb}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div>
          <label className="label" htmlFor="age">Age</label>
          <input id="age" type="number" className="input" value={s.age ?? ""} onChange={(e) => set({ age: num(e.target.value) })} />
        </div>
        <div>
          <label className="label" htmlFor="sex">Sex</label>
          <select id="sex" className="input" value={s.sex ?? ""} onChange={(e) => set({ sex: (e.target.value || null) as HealthSummary["sex"] })}>
            <option value="">Prefer not to say</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="h">Height (cm)</label>
          <input id="h" type="number" className="input" value={s.heightCm ?? ""} onChange={(e) => set({ heightCm: num(e.target.value) })} />
        </div>
        <div>
          <label className="label" htmlFor="w">Weight (kg)</label>
          <input id="w" type="number" className="input" value={s.weightKg ?? ""} onChange={(e) => set({ weightKg: num(e.target.value) })} />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="last">When was your last blood sugar / diabetes test?</label>
        <select id="last" className="input" value={s.lastDiabetesTest} onChange={(e) => set({ lastDiabetesTest: e.target.value as LastTest })}>
          {(["within_1y", "1_3y", "over_3y", "never", "unknown"] as LastTest[]).map((t) => (
            <option key={t} value={t}>{lastTestLabel(t)}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="raw">Your blood relatives&apos; health, and any medicines you take or give — in your own words</label>
        <textarea
          id="raw"
          rows={5}
          className="input"
          value={c.rawHistory}
          onChange={(e) => setC({ ...c, rawHistory: e.target.value })}
          placeholder="e.g. my dad got sugar at around 52, mum has high blood pressure. I give my mum metformin…"
        />
        <p className="mt-1 text-xs text-muted">Any mix of languages is fine. Leave out names and NRIC.</p>
      </div>

      <fieldset>
        <legend className="label">Do you have any of these right now? (optional)</legend>
        <div className="flex flex-wrap gap-2">
          {SYMPTOM_OPTIONS.map((x) => (
            <button
              key={x}
              type="button"
              onClick={() => toggleSymptom(x)}
              className={`chip border px-3 py-1 ${s.symptoms.includes(x) ? "border-accent bg-accent text-accent-ink" : "border-line-strong bg-surface text-ink"}`}
            >
              {x}
            </button>
          ))}
        </div>
      </fieldset>

      <button className="btn-primary" disabled={busy || s.age === null || !c.rawHistory.trim()} onClick={onSubmit}>
        {busy ? "Structuring your history…" : "Turn this into a summary"}
      </button>
    </section>
  );
}

function Confirm({ c, setC, onBack, onConfirm }: { c: CareCase; setC: (c: CareCase) => void; onBack: () => void; onConfirm: () => void }) {
  const s = c.summary;
  const [checked, setChecked] = useState(false);
  const set = (patch: Partial<HealthSummary>) => setC({ ...c, summary: { ...s, ...patch } });
  const setRel = (i: number, patch: Partial<Relative>) => set({ relatives: s.relatives.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const setMed = (i: number, patch: Partial<Medication>) => set({ medications: s.medications.map((m, j) => (j === i ? { ...m, ...patch } : m)) });
  const bmi = bmiOf(s);

  return (
    <section className="space-y-4">
      <div className="card space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">Is this right?</h1>
          <span className={`chip ${c.parsedBy === "ai" ? "tone-accent" : "bg-warn-soft text-warn"}`}>
            {c.parsedBy === "ai" ? "Structured by AI" : "Basic parser (AI offline)"}
          </span>
        </div>
        <p className="text-sm text-muted">
          Check every row against what you wrote. Fix or delete anything wrong. Nudges are only worked out after you confirm.
        </p>
        <blockquote className="rounded-lg bg-raised p-3 text-sm text-muted italic">“{c.rawHistory}”</blockquote>
        {s.uncertain.length > 0 && (
          <div className="rounded-lg bg-warn-soft p-3 text-sm text-warn">
            <p className="font-semibold">Please double-check:</p>
            <ul className="list-disc pl-5">{s.uncertain.map((u) => <li key={u}>{u}</li>)}</ul>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="mb-3 font-bold">Blood relatives</h2>
        {s.relatives.length === 0 && <p className="text-sm text-muted">None found. Add any you know of.</p>}
        <div className="space-y-2">
          {s.relatives.map((r, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1.4fr_7rem_6rem_auto]">
              <input className="input" aria-label="Relation" value={r.relation} onChange={(e) => setRel(i, { relation: e.target.value })} />
              <input className="input" aria-label="Condition" value={r.condition} onChange={(e) => setRel(i, { condition: e.target.value })} />
              <select className="input" aria-label="Closeness" value={r.degree} onChange={(e) => setRel(i, { degree: Number(e.target.value) as 1 | 2 })}>
                <option value={1}>Parent / sibling / child</option>
                <option value={2}>Grandparent / aunt / uncle</option>
              </select>
              <input className="input" aria-label="Age at diagnosis" placeholder="Age dx" type="number" value={r.ageAtDiagnosis ?? ""} onChange={(e) => setRel(i, { ageAtDiagnosis: num(e.target.value) })} />
              <button className="btn-danger" aria-label="Remove relative" onClick={() => set({ relatives: s.relatives.filter((_, j) => j !== i) })}>✕</button>
            </div>
          ))}
        </div>
        <button className="btn-secondary mt-3" onClick={() => set({ relatives: [...s.relatives, { relation: "", degree: 1, condition: "", ageAtDiagnosis: null }] })}>
          + Add relative
        </button>
      </div>

      <div className="card">
        <h2 className="mb-3 font-bold">Medicines</h2>
        {s.medications.length === 0 && <p className="text-sm text-muted">None listed.</p>}
        <div className="space-y-2">
          {s.medications.map((m, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_10rem_auto]">
              <input className="input" aria-label="Medicine" value={m.name} onChange={(e) => setMed(i, { name: e.target.value })} />
              <input className="input" aria-label="Purpose" placeholder="For…" value={m.purpose ?? ""} onChange={(e) => setMed(i, { purpose: e.target.value || null })} />
              <select className="input" aria-label="Taken by" value={m.forWhom} onChange={(e) => setMed(i, { forWhom: e.target.value as Medication["forWhom"] })}>
                <option value="me">I take it</option>
                <option value="someone_i_care_for">Someone I care for</option>
              </select>
              <button className="btn-danger" aria-label="Remove medicine" onClick={() => set({ medications: s.medications.filter((_, j) => j !== i) })}>✕</button>
            </div>
          ))}
        </div>
        <button className="btn-secondary mt-3" onClick={() => set({ medications: [...s.medications, { name: "", purpose: null, forWhom: "me" }] })}>
          + Add medicine
        </button>
      </div>

      <div className="card space-y-2 text-sm">
        <h2 className="font-bold">About you</h2>
        <p>
          Age {s.age ?? "—"} · BMI {bmi ?? "—"} · Last diabetes test: {lastTestLabel(s.lastDiabetesTest)}
          {s.symptoms.length > 0 && <> · Symptoms: {s.symptoms.join(", ")}</>}
        </p>
        {s.sex !== "male" && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={s.gestationalDiabetes === true} onChange={(e) => set({ gestationalDiabetes: e.target.checked ? true : null })} />
            I had diabetes during a pregnancy (gestational diabetes)
          </label>
        )}
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={s.onDiabetesTreatment} onChange={(e) => set({ onDiabetesTreatment: e.target.checked })} />
          I already take medicine for diabetes myself
        </label>
      </div>

      <div className="card space-y-3">
        <label className="flex items-start gap-2 text-sm font-medium">
          <input type="checkbox" className="mt-1" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          I&apos;ve checked this summary and it matches what I know.
        </label>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={onBack}>Back</button>
          <button className="btn-primary" disabled={!checked} onClick={onConfirm}>Confirm and see my nudges</button>
        </div>
      </div>
    </section>
  );
}

function Nudges({ c, persist, onRestart, onEdit, onEditHistory }: { c: CareCase; persist: (c: CareCase) => void; onRestart: () => void; onEdit: () => void; onEditHistory: () => void }) {
  const rules = c.rules!;
  const [loadingPlain, setLoadingPlain] = useState(false);
  const [plainNote, setPlainNote] = useState("");
  const [booking, setBooking] = useState({ where: "", date: "", time: "" });
  const [showCalendarPrompt, setShowCalendarPrompt] = useState(false);
  const hasPlain = rules.nudges.some((n) => n.plain);

  // Clinic and sharing live on the server; this check's share (if any) comes from /api/shares.
  const { user } = useSession();
  const clinic = CLINICS.find((x) => x.id === user?.clinicId) ?? null;
  const now = useNow();
  const clinicStatus = clinic ? openStatus(clinic, now) : null;
  type ActiveShare = { id: string; caseId: string; clinicName: string; appointmentDate: string; expiresAt: string };
  const [share, setShare] = useState<ActiveShare | null>(null);
  const [showConsent, setShowConsent] = useState(false);
  const [shareError, setShareError] = useState("");
  const loadShare = async () => {
    const res = await fetch("/api/shares", { cache: "no-store" });
    const data = await res.json();
    const mine = (data.shares as ActiveShare[] | undefined)?.find((s) => s.caseId === c.id) ?? null;
    setShare(mine);
    if (!mine && c.sharedAt) persist({ ...c, sharedAt: null });
  };
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadShare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.clinicId]);
  // The appointment that unlocks sharing: a booked visit at the current clinic.
  const today = new Date().toISOString().slice(0, 10);
  const appointment = clinic
    ? [...c.followUps].filter((f) => f.status === "booked" && f.where === clinic.name).sort((a, b) => b.dueDate.localeCompare(a.dueDate))[0] ?? null
    : null;
  const canShare = !!appointment && appointment.dueDate >= today;

  const rewrite = async (language: string) => {
    setLoadingPlain(true);
    setPlainNote("");
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nudges: rules.nudges, language }),
      });
      const out = await res.json();
      if (!out.items) {
        setPlainNote("Plain-language rewrite is unavailable right now — showing the original rule wording.");
        return;
      }
      const byId = new Map<string, { headline: string; why: string; whatToDo: string }>(out.items.map((i: { ruleId: string }) => [i.ruleId, i]));
      persist({
        ...c,
        language,
        rules: {
          ...rules,
          nudges: rules.nudges.map((n) => {
            const p = byId.get(n.ruleId);
            return p ? { ...n, plain: { ...p, language } } : { ...n, plain: undefined };
          }),
        },
      });
    } catch {
      setPlainNote("Couldn't reach the server — showing the original rule wording.");
    } finally {
      setLoadingPlain(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="card flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Your nudges</h1>
          <p className="text-sm text-muted">
            Decided by the diabetes screening rules from your confirmed summary. Checked {new Date(rules.checkedAt).toLocaleString()}.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="label" htmlFor="lang">Language</label>
            <select id="lang" className="input w-auto" value={c.language} onChange={(e) => rewrite(e.target.value)} disabled={loadingPlain || !rules.nudges.length}>
              {LANGUAGES.map((l) => <option key={l.name}>{l.name}</option>)}
            </select>
          </div>
          <button className="btn-secondary" disabled={loadingPlain || !rules.nudges.length} onClick={() => rewrite(c.language)}>
            {loadingPlain ? "Rewording…" : hasPlain ? "Reword again" : "Explain in plain words"}
          </button>
          <button className="btn-secondary" onClick={onEdit}>Edit summary</button>
          <button className="btn-secondary" onClick={onEditHistory}>Edit history</button>
        </div>
      </div>
      {plainNote && <p className="rounded-lg bg-warn-soft p-3 text-sm text-warn">{plainNote}</p>}

      {rules.nudges.length > 0 && <NudgeCard nudges={rules.nudges} language={c.language} showPlain />}

      {rules.noNudgeNotice && (
        <div className="card border-l-4 border-l-line-strong">
          <span className="chip mb-2 bg-raised text-ink">{rules.suppressedBecauseTreated ? "Already in care" : "No nudge today — not an all-clear"}</span>
          <p className="text-sm">{rules.noNudgeNotice}</p>
        </div>
      )}

      {rules.nudges[0] && <TeachBack c={c} />}

      <button className="btn-secondary w-full" onClick={onRestart}>Start a new check (this one stays saved)</button>

      {clinicStatus && !clinicStatus.open && <UrgentCare title="Your clinic is closed right now." origin={null} />}

      <ClinicUpdates />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card space-y-3">
          <h2 className="font-bold">Book a check</h2>
          <p className="text-sm text-muted">
            Find a Healthier SG / Screen for Life clinic near you, then note your booking here so it&apos;s tracked.
          </p>
          <a className="btn-secondary" href="https://www.healthiersg.gov.sg/" target="_blank" rel="noreferrer">Find a clinic <Icon name="external" className="h-4 w-4" /></a>
          {clinic ? (
            <p className="text-sm">
              Booking at <b>{clinic.name}</b> ({clinic.area}). <Link href="/choose-clinic" className="text-accent-text underline">Change clinic</Link>
              <span className={`block font-semibold ${clinicStatus?.open ? "text-ok" : "text-bad"}`}>{clinicStatus?.label}</span>
            </p>
          ) : (
            <p className="text-sm"><Link href="/choose-clinic" className="text-accent-text underline">Choose a clinic</Link> to book.</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <input className="input" type="date" aria-label="Appointment date" value={booking.date} onChange={(e) => setBooking({ ...booking, date: e.target.value })} />
            <input className="input" type="time" aria-label="Appointment time (optional)" value={booking.time} onChange={(e) => setBooking({ ...booking, time: e.target.value })} />
          </div>
          <button
            className="btn-primary"
            disabled={!booking.date || !clinic}
            onClick={() => {
              persist({
                ...c,
                followUps: [
                  ...c.followUps,
                  { id: newId(), test: "Diabetes screening (blood test)", dueDate: booking.date, ...(booking.time ? { time: booking.time } : {}), status: "booked", where: clinic!.name, result: "", createdBy: "patient" },
                ],
              });
              setShowCalendarPrompt(true);
            }}
          >
            Save booking
          </button>
          {showCalendarPrompt && (
            <div className="rounded-lg border border-accent/40 bg-accent-soft p-3">
              <p className="mb-2 text-sm font-semibold text-accent-text">Add to Google Calendar?</p>
              <div className="flex gap-2">
                <button
                  className="btn-primary text-sm py-1"
                  onClick={() => {
                    const startDate = new Date(booking.date);
                    const endDate = new Date(startDate);
                    endDate.setHours(startDate.getHours() + 1);
                    const calendarUrl = new URL("https://calendar.google.com/calendar/r/eventedit");
                    calendarUrl.searchParams.set("text", `Diabetes screening${clinic ? ` at ${clinic.name}` : ""}`);
                    calendarUrl.searchParams.set("dates", `${startDate.toISOString().replace(/[-:]/g, "").split(".")[0]}Z/${endDate.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`);
                    calendarUrl.searchParams.set("details", "Diabetes screening appointment booked via CareNudge");
                    window.open(calendarUrl.toString(), "_blank");
                    setBooking({ where: "", date: "", time: "" });
                    setShowCalendarPrompt(false);
                  }}
                >
                  Yes
                </button>
                <button
                  className="btn-secondary text-sm py-1"
                  onClick={() => {
                    setBooking({ where: "", date: "", time: "" });
                    setShowCalendarPrompt(false);
                  }}
                >
                  No thanks
                </button>
              </div>
            </div>
          )}
          {c.followUps.length > 0 && (
            <>
            <ul className="space-y-2 text-sm">
              {c.followUps.map((f) => {
                const over = f.dueDate < new Date().toISOString().slice(0, 10);
                // Saving the check also updates the clinic's copy (a moved booking reschedules the share).
                const patch = (p: Partial<typeof f>) =>
                  persist({ ...c, followUps: c.followUps.map((x) => (x.id === f.id ? { ...x, ...p } : x)) });
                return (
                  <li key={f.id} className="space-y-2 rounded-lg bg-raised px-3 py-2">
                    <div className="flex justify-between gap-2">
                      <span>{f.test}{f.where && ` · ${f.where}`}</span>
                      {over && f.status !== "done" && <span className="chip bg-bad-soft text-bad">appointment date passed</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input aria-label="Appointment date" type="date" className="input w-auto py-1" value={f.dueDate} onChange={(e) => patch({ dueDate: e.target.value })} />
                      <select aria-label="Status" className="input w-auto py-1" value={f.status} onChange={(e) => patch({ status: e.target.value as typeof f.status })}>
                        {["planned", "booked", "done", "missed"].map((x) => <option key={x}>{x}</option>)}
                      </select>
                      {(over || f.status === "done" || f.status === "missed") && (
                        <button className="btn-danger py-1" onClick={() => persist({ ...c, followUps: c.followUps.filter((x) => x.id !== f.id) })}>
                          Remove
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-muted">Appointments are removed automatically a week after their date.</p>
            </>
          )}
        </div>

        <div className="card space-y-3">
          <h2 className="font-bold">
            Share with my clinic
          </h2>
          <p className="text-sm text-muted">
            Your clinic only sees your summary if you book there and agree. You choose what is sent, and can stop any time.
          </p>
          {shareError && <p className="rounded-lg bg-bad-soft p-2 text-sm text-bad">{shareError}</p>}
          {share ? (
            <>
              <p className="text-sm text-accent-text">
                <b>{share.clinicName}</b> has your summary until {new Date(share.expiresAt).toLocaleDateString()}.
              </p>
              <button
                className="btn-danger"
                onClick={async () => {
                  await fetch(`/api/shares?id=${share.id}`, { method: "DELETE" });
                  persist({ ...c, sharedAt: null });
                  await loadShare();
                }}
              >
                Stop sharing (revoke access)
              </button>
            </>
          ) : showConsent && clinic && appointment ? (
            <ShareConsent
              c={c}
              clinicName={clinic.name}
              appointmentDate={appointment.dueDate}
              onCancel={() => setShowConsent(false)}
              onConfirm={async (reports) => {
                setShareError("");
                // Each ticked document is marked shared, the rest private. Save the check first: the server shares what it holds.
                const chosen = new Set(reports.map((r) => r.id));
                const next = { ...c, reports: (c.reports ?? []).map((r) => ({ ...r, shared: chosen.has(r.id) })) };
                persist(next);
                if (!(await saveNow(next))) return setShareError("Couldn't save your check. Try again.");
                const res = await fetch("/api/shares", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ consent: true, caseId: c.id, appointmentDate: appointment.dueDate }),
                });
                if (!res.ok) return setShareError((await res.json()).error ?? "Couldn't share.");
                persist({ ...next, sharedAt: new Date().toISOString() });
                setShowConsent(false);
                await loadShare();
              }}
            />
          ) : (
            <>
              <button className="btn-primary" disabled={!canShare} onClick={() => setShowConsent(true)}>
                {clinic ? `Share with ${clinic.name}` : "Share with my clinic"}
              </button>
              {!canShare && <p className="text-xs text-muted">Book an upcoming appointment with your clinic first. Sharing unlocks after booking.</p>}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function TeachBack({ c }: { c: CareCase }) {
  const nudge = c.rules!.nudges[0];
  const opts = useMemo(() => teachBackOptions(nudge), [nudge]);
  const [why, setWhy] = useState("");
  const [action, setAction] = useState("");
  const [done, setDone] = useState<null | { w: boolean; a: boolean }>(null);

  return (
    <div className="card space-y-3 bg-accent-soft/40">
      <h2 className="font-bold">Quick check: did the nudge make sense?</h2>
      <p className="text-sm text-muted">About your top nudge. Your answers help us test whether CareNudge is clear.</p>
      {[
        { q: "Why did this nudge appear?", options: opts.why, value: why, set: setWhy, name: "why" },
        { q: "What should you do next?", options: opts.action, value: action, set: setAction, name: "action" },
      ].map((block) => (
        <fieldset key={block.name} disabled={!!done}>
          <legend className="label">{block.q}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {block.options.map((o) => (
              <label key={o} className={`flex items-center gap-2 rounded-lg border bg-surface px-3 py-2 text-sm ${block.value === o ? "border-accent" : "border-line"}`}>
                <input type="radio" name={block.name} checked={block.value === o} onChange={() => block.set(o)} />
                {o}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      {!done ? (
        <button
          className="btn-primary"
          disabled={!why || !action}
          onClick={() => {
            const r = { w: why === nudge.whyShort, a: action === nudge.actionShort };
            recordTeachBack({ caseId: c.id, ruleId: nudge.ruleId, whyCorrect: r.w, actionCorrect: r.a, at: new Date().toISOString() });
            // Also tell the server so the patient's clinic can count it (only while they share with it).
            fetch("/api/teachback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ruleId: nudge.ruleId, whyCorrect: r.w, actionCorrect: r.a }) }).catch(() => {});
            setDone(r);
          }}
        >
          Submit
        </button>
      ) : (
        <p className="text-sm">
          {done.w && done.a ? <span className="inline-flex items-center gap-1 font-semibold text-ok"><Tick className="h-5 w-5" /> Spot on.</span> : `The answer: ${nudge.whyShort.toLowerCase()} → ${nudge.actionShort.toLowerCase()}.`} Thanks — recorded on the{" "}
          <Link href="/metrics" className="text-accent-text underline">results page</Link>.
        </p>
      )}
    </div>
  );
}
