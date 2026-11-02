"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { LiveStamp } from "@/components/LiveStamp";
import { useLive } from "@/lib/useLive";
import { sgToday } from "@/lib/sgtime";

type Status = "scheduled" | "cancelled" | "no_show" | "completed";
interface Appt {
  id: string;
  patientName: string;
  date: string;
  time: string | null;
  status: Status;
  reportCount?: number; // doctors only
  /** The last cancel or reschedule. `unseen` is true until this role presses "Got it". */
  /** "new": this user has never looked at it. "changed": it changed since they last looked. */
  flag: "new" | "changed" | null;
  change: { kind: "cancelled" | "rescheduled"; by: "patient" | "clinic"; at: string; fromDate: string; fromTime: string | null; unseen: boolean } | null;
}

const CHIP: Record<Status, string> = {
  scheduled: "bg-info-soft text-info",
  completed: "bg-ok-soft text-ok",
  cancelled: "bg-raised text-muted",
  no_show: "bg-bad-soft text-bad",
};
const LABEL: Record<Status, string> = { scheduled: "Scheduled", completed: "Completed", cancelled: "Cancelled", no_show: "No-show" };

/**
 * The clinic schedule from /api/appointments (name, date, time, status only).
 * Doctors get a read-only list that links to the patient; operations can reschedule, cancel
 * or mark a no-show. The server enforces which actions each role may take.
 */
export function Schedule({ mode }: { mode: "doctor" | "ops" }) {
  const [edit, setEdit] = useState<Record<string, { date: string; time: string }>>({});
  const [note, setNote] = useState("");
  const today = sgToday();

  // Fresh data every 12 seconds and whenever the tab is shown, so patient changes appear without a refresh.
  const fetchRows = useCallback(async () => {
    const res = await fetch("/api/appointments", { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status)); // keep what is on screen rather than showing an empty schedule
    return ((await res.json()).appointments ?? []) as Appt[];
  }, []);
  const { data: rows, at, refresh: load } = useLive(fetchRows);

  const gotIt = async (a: Appt) => {
    await fetch("/api/appointments", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shareId: a.id }) });
    await load();
  };

  const act = async (a: Appt, action: "reschedule" | "cancel" | "no_show") => {
    const e = edit[a.id] ?? { date: a.date, time: a.time ?? "" };
    const res = await fetch("/api/appointments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shareId: a.id, action, date: e.date, time: e.time || null }),
    });
    setNote(res.ok ? "Saved." : "Couldn't save. This booking may have been revoked.");
    await load();
  };

  if (!rows) return <p className="text-faint">Loading…</p>;
  const upcoming = rows.filter((r) => r.date >= today);
  const past = rows.filter((r) => r.date < today);

  const renderRow = (a: Appt) => {
    const e = edit[a.id] ?? { date: a.date, time: a.time ?? "" };
    return (
      <div key={a.id} className="card space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-semibold">{a.patientName}</p>
            <p className="text-sm text-muted">{a.date} · {a.time ?? "time not set"}</p>
          </div>
          <span className={`chip ${CHIP[a.status]}`}>{LABEL[a.status]}</span>
        </div>
        {a.flag && !a.change?.unseen && (
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="chip bg-bad-soft text-bad">{a.flag === "new" ? "New booking" : "New changes"}</span>
            <button className="btn-secondary ml-auto py-1 text-xs" onClick={() => gotIt(a)}>Got it</button>
          </p>
        )}
        {a.change && (
          <p className="flex flex-wrap items-center gap-2 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
            {a.change.unseen && <span className="chip bg-bad-soft text-bad">New change</span>}
            <span>
              {a.change.kind === "cancelled" ? "Cancelled" : "Rescheduled"} by {a.change.by} · was {a.change.fromDate}
              {a.change.fromTime ? ` at ${a.change.fromTime}` : ""} · {new Date(a.change.at).toLocaleString("en-SG", { timeZone: "Asia/Singapore" })}
            </span>
            {a.change.unseen && <button className="btn-secondary ml-auto py-1 text-xs" onClick={() => gotIt(a)}>Got it</button>}
          </p>
        )}
        {mode === "doctor" ? (
          a.status !== "cancelled" && (
            <div className="flex flex-wrap gap-2">
              <Link href={`/doctor/patient?id=${encodeURIComponent(a.id)}`} className="btn-secondary py-2 text-sm">Open patient</Link>
              <Link href={`/doctor/brief?id=${encodeURIComponent(a.id)}`} className="btn-secondary py-2 text-sm">View brief</Link>
              <Link href={`/doctor/patient?id=${encodeURIComponent(a.id)}&tab=reports`} className="btn-secondary py-2 text-sm">Reports ({a.reportCount ?? 0})</Link>
            </div>
          )
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <input aria-label="Date" type="date" className="input w-auto py-1" value={e.date} onChange={(ev) => setEdit({ ...edit, [a.id]: { ...e, date: ev.target.value } })} />
            <input aria-label="Time" type="time" className="input w-auto py-1" value={e.time} onChange={(ev) => setEdit({ ...edit, [a.id]: { ...e, time: ev.target.value } })} />
            <button className="btn-primary py-2 text-sm" onClick={() => act(a, "reschedule")}>Reschedule</button>
            {a.status !== "cancelled" && <button className="btn-secondary py-2 text-sm" onClick={() => act(a, "cancel")}>Cancel</button>}
            {a.status !== "no_show" && <button className="btn-secondary py-2 text-sm" onClick={() => act(a, "no_show")}>Mark no-show</button>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-bold text-accent-text">{mode === "doctor" ? "Schedule" : "Appointments"}</h1>
        <p className="text-muted">
          {mode === "doctor"
            ? "Patients who booked at your clinic and agreed to share. A cancelled booking stays on the list, greyed out, with no patient details."
            : "Your clinic's appointments: name, time and status only. No health details are shown to operations staff."}{" "}
          Today is {today} (Singapore). <LiveStamp at={at} />
        </p>
      </div>
      {note && <p className="text-sm text-accent-text">{note}</p>}

      <h2 className="font-semibold">Upcoming</h2>
      {upcoming.length ? <div className="space-y-3">{upcoming.map(renderRow)}</div> : <p className="card text-muted">No upcoming appointments.</p>}

      {past.length > 0 && (
        <>
          <h2 className="font-semibold">Earlier</h2>
          <div className="space-y-3">{past.map(renderRow)}</div>
        </>
      )}
    </div>
  );
}
