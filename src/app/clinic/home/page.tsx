"use client";

import Link from "next/link";
import { useCallback } from "react";
import { LiveStamp } from "@/components/LiveStamp";
import { DAY_NAMES } from "@/lib/hours";
import { useLive } from "@/lib/useLive";

interface Row { id: string; patientName: string; date: string; time: string | null; status: string }
interface Home {
  today: string;
  clinic: { name: string; area: string; address: string | null; phone: string | null; todayHours: [string, string][] } | null;
  todayRows: Row[];
  attention: Row[];
  week: { appointments: number; noShows: number };
  followUps: { done: number; overdue: number };
  reminders: { sharedBookings: number; withReminder: number };
}

const STATUS: Record<string, string> = { scheduled: "Scheduled", completed: "Completed", no_show: "No-show", cancelled: "Cancelled" };

/** Clinic operations home: schedule logistics and plain counts only. The API returns no clinical data. */
export default function ClinicHomePage() {
  const fetchHome = useCallback(async () => {
    const res = await fetch("/api/ops-home", { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as Home;
  }, []);
  const { data: h, at } = useLive(fetchHome);

  const stat = (label: string, value: string | number) => (
    <div className="rounded-lg bg-raised p-3">
      <p className="text-2xl font-bold text-accent-text">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-bold text-accent-text">Clinic home</h1>
        <p className="text-muted">{h?.clinic?.name} · Today is {h?.today} (Singapore). <LiveStamp at={at} /></p>
      </div>

      {!h ? (
        <p className="text-faint">Loading…</p>
      ) : (
        <>
          <section className="card space-y-3">
            <h2 className="font-semibold text-accent-text">Today&apos;s appointments</h2>
            {h.todayRows.length === 0 ? (
              <p className="text-muted">No appointments today.</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {h.todayRows.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span><b>{r.time ?? "time not set"}</b> · {r.patientName}</span>
                    <span className="chip bg-raised text-muted">{STATUS[r.status] ?? r.status}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/clinic" className="text-sm text-accent-text underline">Open all appointments (reschedule, cancel, mark no-show)</Link>
          </section>

          <section className="card space-y-3">
            <h2 className="font-semibold text-accent-text">No-shows and cancellations</h2>
            {h.attention.length === 0 ? (
              <p className="text-muted">No recent no-shows and no upcoming cancellations.</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {h.attention.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>{r.patientName} · {r.date}{r.time ? ` at ${r.time}` : ""}</span>
                    <span className="flex items-center gap-2">
                      <span className={`chip ${r.status === "no_show" ? "bg-bad-soft text-bad" : "bg-raised text-muted"}`}>{STATUS[r.status] ?? r.status}</span>
                      <Link href="/clinic" className="text-accent-text underline">Reschedule</Link>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-accent-text">This week in numbers</h2>
              <span className="chip bg-warn-soft text-warn">Demo data - not real clinic results</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {stat("Appointments this week", h.week.appointments)}
              {stat("No-shows (last 7 days)", h.week.noShows)}
              {stat("Follow-ups done", h.followUps.done)}
              {stat("Follow-ups overdue", h.followUps.overdue)}
            </div>
            <p className="text-sm text-muted">
              Shared bookings that came with a screening reminder: <b>{h.reminders.withReminder}</b> of <b>{h.reminders.sharedBookings}</b>. Counts only.
            </p>
          </section>

          <section className="card space-y-2">
            <h2 className="font-semibold text-accent-text">Clinic profile and listing</h2>
            {h.clinic && (
              <>
                <p className="font-semibold">{h.clinic.name} <span className="font-normal text-muted">({h.clinic.area})</span></p>
                <p className="text-sm text-muted">
                  Today ({DAY_NAMES[new Date(`${h.today}T12:00:00+08:00`).getUTCDay()]}):{" "}
                  {h.clinic.todayHours.length ? h.clinic.todayHours.map(([o, c]) => `${o}–${c}`).join(", ") : "closed"}
                </p>
                <p className="text-sm text-muted">{h.clinic.address ?? "No address added yet"}{h.clinic.phone ? ` · ${h.clinic.phone}` : ""}</p>
              </>
            )}
            <Link href="/clinic/profile" className="btn-secondary w-full sm:w-auto">Edit clinic profile</Link>
          </section>

          <div className="flex flex-wrap gap-2">
            <Link href="/clinic" className="btn-secondary">Appointments</Link>
            <Link href="/clinic/followups" className="btn-secondary">Follow-ups</Link>
            <Link href="/clinic/dashboard" className="btn-secondary">Dashboard</Link>
            <Link href="/clinic/subscription" className="btn-secondary">Plan</Link>
          </div>
        </>
      )}
    </div>
  );
}
