"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession, type SessionUser } from "@/components/Session";
import type { Clinic } from "@/lib/clinics";
import { ROLE_LABEL, homeFor, type Role } from "@/lib/roles";

// Where a signed-in user goes next (patients without a clinic choose one first).
const nextStop = (u: SessionUser) => (u.role === "patient" && !u.clinicId ? "/choose-clinic" : homeFor(u.role));

type Step = "who" | "staff" | "clinic" | "details";

export default function SignupPage() {
  const router = useRouter();
  const { user, demoUsers, refresh, signOut } = useSession();

  // The home page links here with ?role=patient or ?who=clinic.
  const [start] = useState(() => new URLSearchParams(window.location.search));
  const presetRole = start.get("role");
  const [role, setRole] = useState<Role | null>(presetRole === "patient" ? "patient" : null);
  const [step, setStep] = useState<Step>(presetRole === "patient" ? "details" : start.get("who") === "clinic" ? "staff" : "who");
  const [clinicId, setClinicId] = useState("");
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/clinics").then((r) => r.json()).then((d) => setClinics(d.clinics));
  }, []);

  // Already signed in as the role the visitor asked for: skip straight ahead.
  useEffect(() => {
    if (user && presetRole === "patient" && user.role === "patient") router.replace(nextStop(user));
  }, [user, presetRole, router]);

  const signIn = async (body: object) => {
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Couldn't sign in.");
    await refresh();
    router.push(nextStop(data.user));
  };

  const clinicName = (id: string | null) => clinics.find((c) => c.id === id)?.name ?? "";
  const choice = "card w-full text-left hover:ring-2 hover:ring-accent";

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold text-accent-text">Sign up or sign in</h1>
        <p className="rounded-lg border border-warn-line bg-warn-soft px-3 py-2 text-sm text-warn">
          <b>Demo sign-in - no real accounts.</b> Use any name and email. There are no passwords and nothing is verified. Fake data only.
        </p>
      </div>

      {user && (
        <div className="card flex flex-wrap items-center justify-between gap-3">
          <p>
            Signed in as <b>{user.name}</b> ({ROLE_LABEL[user.role]})
          </p>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={() => router.push(nextStop(user))}>Continue</button>
            <button className="btn-secondary" onClick={signOut}>Sign out</button>
          </div>
        </div>
      )}

      {step === "who" && (
        <div className="space-y-3">
          <h2 className="font-semibold">Step 1: Who are you?</h2>
          <button className={choice} onClick={() => { setRole("patient"); setStep("details"); }}>
            <b>I&apos;m a patient</b>
            <span className="block text-sm text-muted">Check my screening, book a clinic, share my summary if I choose.</span>
          </button>
          <button className={choice} onClick={() => setStep("staff")}>
            <b>I&apos;m from a clinic</b>
            <span className="block text-sm text-muted">Doctors and operations staff.</span>
          </button>
        </div>
      )}

      {step === "staff" && (
        <div className="space-y-3">
          <h2 className="font-semibold">Step 2: Your role at the clinic</h2>
          <button className={choice} onClick={() => { setRole("clinic_ops"); setStep("clinic"); }}>
            <b>Operations</b>
            <span className="block text-sm text-muted">Appointments, follow-up logistics, clinic profile and dashboard. No patient health details.</span>
          </button>
          <button className={choice} onClick={() => { setRole("doctor"); setStep("clinic"); }}>
            <b>Doctor</b>
            <span className="block text-sm text-muted">Schedule and patient requests that booked and agreed to share.</span>
          </button>
          <button className="text-sm underline" onClick={() => setStep("who")}>Back</button>
        </div>
      )}

      {step === "clinic" && (
        <div className="space-y-3">
          <h2 className="font-semibold">Step 3: Which clinic do you belong to?</h2>
          <p className="text-xs text-faint">Fictional demo clinics. You stay at this clinic once you sign up.</p>
          <select className="input" value={clinicId} onChange={(e) => setClinicId(e.target.value)} aria-label="Clinic">
            <option value="" disabled>Choose your clinic…</option>
            {clinics.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.area})</option>)}
          </select>
          <div className="flex gap-2">
            <button className="btn-primary" disabled={!clinicId} onClick={() => setStep("details")}>Continue</button>
            <button className="btn-secondary" onClick={() => setStep("staff")}>Back</button>
          </div>
        </div>
      )}

      {step === "details" && role && (
        <form
          className="card space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            signIn({ name, email, role, clinicId: role === "patient" ? undefined : clinicId });
          }}
        >
          <h2 className="font-semibold">
            {role === "patient" ? "Your details" : `${ROLE_LABEL[role]} at ${clinicName(clinicId)}`}
          </h2>
          <div>
            <label className="label" htmlFor="name">Name</label>
            <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} />
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-bad">{error}</p>}
          <div className="flex gap-2">
            <button className="btn-primary" disabled={busy}>{busy ? "Signing in…" : "Continue"}</button>
            <button type="button" className="btn-secondary" onClick={() => setStep("who")}>Start over</button>
          </div>
        </form>
      )}
      {step !== "details" && error && <p className="text-sm text-bad">{error}</p>}

      <div className="card space-y-3">
        <h2 className="font-semibold text-accent-text">Or switch to a demo user</h2>
        {(["patient", "doctor", "clinic_ops"] as Role[]).map((r) => {
          const group = demoUsers.filter((u) => u.role === r);
          if (!group.length) return null;
          return (
            <div key={r} className="space-y-1">
              <p className="text-sm font-semibold text-muted capitalize">{ROLE_LABEL[r]}s</p>
              <div className="flex flex-wrap gap-2">
                {group.map((u) => (
                  <button key={u.id} className="btn-secondary py-2 text-sm" disabled={busy} onClick={() => signIn({ userId: u.id })}>
                    {u.name}{u.clinicId ? ` · ${clinicName(u.clinicId).replace(/ (Family |Community )?Clinic$/, "")}` : ""}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
