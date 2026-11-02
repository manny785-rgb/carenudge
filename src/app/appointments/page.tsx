"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BookingForm } from "@/components/BookingForm";
import { ClinicUpdates } from "@/components/ClinicUpdates";
import { sgToday } from "@/lib/sgtime";
import { saveNow, useStore } from "@/lib/storage";
import type { CareCase, FollowUp } from "@/lib/types";

// The clinic's copy of an appointment exists only for a check the patient has shared with that clinic.
interface ShareView {
  id: string;
  caseId: string;
  bookingId: string | null;
  clinicName: string;
  expiresAt: string;
  appointmentDate: string;
  appointmentTime: string | null;
  appointmentStatus: "scheduled" | "cancelled" | "no_show" | "completed";
}

interface Booking {
  c: CareCase;
  f: FollowUp;
  share: ShareView | null;
}

const when = (date: string, time?: string | null) => `${date}${time ? ` at ${time}` : ""}`;

/** The patient's appointments: bookings saved on their checks, plus what the clinic holds for shared ones. */
export default function AppointmentsPage() {
  const store = useStore();
  const cases = store?.cases ?? [];
  const [shares, setShares] = useState<ShareView[]>([]);
  const [edit, setEdit] = useState<Record<string, { date: string; time: string }>>({});
  const [bookFor, setBookFor] = useState("");
  const [note, setNote] = useState("");
  const today = sgToday();

  const loadShares = useCallback(async () => {
    const d = await (await fetch("/api/shares", { cache: "no-store" })).json();
    setShares(d.shares ?? []);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadShares();
  }, [loadShares]);

  // A booking's clinic copy is the share that follows it (the same check and booking id).
  const bookings: Booking[] = cases
    .flatMap((c) => c.followUps.filter((f) => f.createdBy === "patient").map((f) => ({ c, f })))
    .map(({ c, f }) => ({ c, f, share: shares.find((s) => s.caseId === c.id && s.bookingId === f.id) ?? null }))
    .sort((a, b) => `${a.f.dueDate} ${a.f.time ?? ""}`.localeCompare(`${b.f.dueDate} ${b.f.time ?? ""}`));

  // A clinic that was told about a booking may have rescheduled or cancelled it. Show that too.
  const clinicChanges = shares.filter((s) => !bookings.some((b) => b.share?.id === s.id) && s.appointmentStatus !== "scheduled");

  // Changing the check is all it takes: the server updates the clinic's copy when the check is saved.
  const cancel = async (b: Booking) => {
    if (!confirm(`Cancel your ${b.f.test.toLowerCase()} at ${b.f.where} on ${b.f.dueDate}?`)) return;
    const ok = await saveNow({ ...b.c, followUps: b.c.followUps.filter((x) => x.id !== b.f.id) });
    setNote(ok ? "Appointment cancelled." + (b.share ? ` ${b.share.clinicName} has been told.` : "") : "Couldn't save. Try again.");
    await loadShares();
  };

  const reschedule = async (b: Booking) => {
    const e = edit[b.f.id] ?? { date: b.f.dueDate, time: b.f.time ?? "" };
    if (!e.date) return;
    const ok = await saveNow({ ...b.c, followUps: b.c.followUps.map((x) => (x.id === b.f.id ? { ...x, dueDate: e.date, ...(e.time ? { time: e.time } : { time: undefined }) } : x)) });
    setNote(ok ? "Appointment updated." + (b.share ? ` ${b.share.clinicName} has been told.` : "") : "Couldn't save. Try again.");
    await loadShares();
  };

  const row = (b: Booking) => {
    const e = edit[b.f.id] ?? { date: b.f.dueDate, time: b.f.time ?? "" };
    const cl = b.share;
    return (
      <div key={`${b.c.id}-${b.f.id}`} className="card space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-semibold">{b.f.test}</p>
            <p className="text-sm text-muted">{b.f.where} · {when(b.f.dueDate, b.f.time)}</p>
          </div>
          <span className="chip bg-info-soft text-info">{b.f.status}</span>
        </div>

        {cl ? (
          <>
            <p className="text-sm text-ok">
              Shared with {cl.clinicName}. The clinic&apos;s record: {when(cl.appointmentDate, cl.appointmentTime)} · {cl.appointmentStatus.replace("_", "-")}.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted">
            Saved to your account. {b.f.where} hasn&apos;t received it. Choose to share from{" "}
            <Link href={`/intake?case=${b.c.id}`} className="underline">My check</Link> if you want the clinic to see it.
          </p>
        )}

        {b.f.status === "booked" && (
          <div className="flex flex-wrap items-center gap-2">
            <input aria-label="New date" type="date" className="input w-auto py-1" min={today} value={e.date} onChange={(ev) => setEdit({ ...edit, [b.f.id]: { ...e, date: ev.target.value } })} />
            <input aria-label="New time" type="time" className="input w-auto py-1" value={e.time} onChange={(ev) => setEdit({ ...edit, [b.f.id]: { ...e, time: ev.target.value } })} />
            <button className="btn-secondary py-2 text-sm" onClick={() => reschedule(b)}>Reschedule</button>
            <button className="btn-danger py-2 text-sm" onClick={() => cancel(b)}>Cancel appointment</button>
          </div>
        )}
      </div>
    );
  };

  if (!store) return <p className="text-faint">Loading…</p>; // wait for the saved checks, so the list never flashes empty

  const upcoming = bookings.filter((b) => b.f.dueDate >= today);
  const earlier = bookings.filter((b) => b.f.dueDate < today);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-bold text-accent-text">My appointments</h1>
        <p className="text-muted">Your bookings, and what your clinic has on record for the ones you shared. Today is {today} (Singapore).</p>
      </div>
      {note && <p className="text-sm text-accent-text">{note}</p>}

      {clinicChanges.map((s) => (
        <p key={s.id} className="rounded-lg border border-warn-line bg-warn-soft p-3 text-sm text-warn">
          {s.clinicName} has this appointment on {when(s.appointmentDate, s.appointmentTime)} as <b>{s.appointmentStatus.replace("_", "-")}</b>.
        </p>
      ))}

      <h2 className="font-semibold">Upcoming</h2>
      {upcoming.length ? <div className="space-y-3">{upcoming.map(row)}</div> : <p className="card text-muted">No upcoming appointments.</p>}

      {earlier.length > 0 && (
        <>
          <h2 className="font-semibold">Earlier</h2>
          <div className="space-y-3">{earlier.map(row)}</div>
        </>
      )}

      <ClinicUpdates />

      <div className="card space-y-3">
        <h2 className="font-semibold text-accent-text">Book an appointment</h2>
        {cases.length === 0 ? (
          <p className="text-sm text-muted">
            Start a check in <Link href="/intake" className="underline">My check</Link> first, then you can book here.
          </p>
        ) : (
          <>
            <div>
              <label className="label" htmlFor="bookcase">For which check?</label>
              <select id="bookcase" className="input" value={bookFor || cases[0].id} onChange={(e) => setBookFor(e.target.value)}>
                {cases.map((c) => <option key={c.id} value={c.id}>{c.displayName} · {new Date(c.createdAt).toLocaleDateString()}</option>)}
              </select>
            </div>
            <BookingForm key={bookFor || cases[0].id} caseId={bookFor || cases[0].id} />
          </>
        )}
      </div>
    </div>
  );
}
