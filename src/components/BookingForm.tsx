"use client";

import { Tick } from "@/components/ui/Tick";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/components/Session";
import type { Clinic } from "@/lib/clinics";
import { openStatus, useNow } from "@/lib/hours";
import { sgToday } from "@/lib/sgtime";
import { getCase, newId, upsertCase } from "@/lib/storage";
import type { CareCase } from "@/lib/types";

const KINDS = ["Diabetes screening (blood test)", "Consultation with a doctor"];

/**
 * Book a screening or consultation at the patient's clinic and save it on the chosen check.
 * Booking does not share anything: the patient can still share their summary later, with
 * explicit consent, from "My check".
 */
export function BookingForm({ caseId }: { caseId: string }) {
  const { user } = useSession();
  const now = useNow();
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [kind, setKind] = useState(KINDS[0]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/clinics")
      .then((r) => r.json())
      .then((d) => setClinic((d.clinics as Clinic[]).find((c) => c.id === user?.clinicId) ?? null));
  }, [user?.clinicId]);

  const save = () => {
    const c: CareCase | null = getCase(caseId);
    if (!c || !clinic || !date) return;
    upsertCase({
      ...c,
      followUps: [
        ...c.followUps,
        { id: newId(), test: kind, dueDate: date, ...(time ? { time } : {}), status: "booked", where: clinic.name, result: "", createdBy: "patient" },
      ],
    });
    setDone(`${kind} booked at ${clinic.name} on ${date}${time ? ` at ${time}` : ""}.`);
    setDate("");
    setTime("");
  };

  const status = clinic ? openStatus(clinic, now) : null;

  return (
    <div className="space-y-3 rounded-lg border border-line bg-surface p-4">
      <h3 className="font-semibold text-accent-text">Book a screening or consultation</h3>
      {clinic ? (
        <p className="text-sm">
          At <b>{clinic.name}</b> ({clinic.area}). <Link href="/choose-clinic" className="text-accent-text underline">Change clinic</Link>
          <span className={`block font-semibold ${status?.open ? "text-ok" : "text-bad"}`}>{status?.label}</span>
        </p>
      ) : (
        <p className="text-sm"><Link href="/choose-clinic" className="text-accent-text underline">Choose a clinic</Link> to book.</p>
      )}

      <div className="grid gap-2 sm:grid-cols-3">
        <select aria-label="Type of appointment" className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
          {KINDS.map((k) => <option key={k}>{k}</option>)}
        </select>
        <input aria-label="Appointment date" type="date" className="input" min={sgToday()} value={date} onChange={(e) => setDate(e.target.value)} />
        <input aria-label="Appointment time (optional)" type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
      </div>
      <button className="btn-primary" disabled={!clinic || !date} onClick={save}>Book appointment</button>

      {done && (
        <p className="flex items-start gap-2 rounded-xl bg-ok-soft p-3 text-sm text-ok"><Tick className="mt-0.5 h-5 w-5" /><span>
          {done} It is saved on your check. You can choose to share your summary with the clinic from{" "}
          <Link href={`/intake?case=${caseId}`} className="underline">My check</Link>.
        </span></p>
      )}
    </div>
  );
}
