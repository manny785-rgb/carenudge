"use client";

import Link from "next/link";
import { useCallback } from "react";
import { LiveStamp } from "@/components/LiveStamp";
import { sgToday } from "@/lib/sgtime";
import { useLive } from "@/lib/useLive";

interface Home {
  today: string;
  clinicName: string;
  schedule: { id: string; patientName: string; time: string | null; status: string }[];
  next: { id: string; patientName: string; time: string | null } | null;
  requests: { total: number; new: number; changed: number; updatedAt: string | null };
  followUps: { overdue: number; dueThisWeek: number; top: { shareId: string; patientName: string; test: string; dueDate: string; bucket: string }[] };
  recent: { shareId: string; patientName: string; at: string; what: string }[];
}

const STATUS: Record<string, string> = { scheduled: "Scheduled", completed: "Completed", no_show: "No-show", cancelled: "Cancelled" };

const ago = (iso: string) => {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  return mins < 1 ? "just now" : mins < 60 ? `${mins} min ago` : mins < 1440 ? `${Math.floor(mins / 60)} h ago` : `${Math.floor(mins / 1440)} d ago`;
};

/** Doctor home. Every section comes from /api/doctor-home, which only returns this clinic's consented, active shares. */
export default function DoctorHomePage() {
  const fetchHome = useCallback(async () => {
    const res = await fetch("/api/doctor-home", { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as Home;
  }, []);
  const { data: h, at } = useLive(fetchHome);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-bold text-accent-text">Doctor home</h1>
        <p className="text-muted">{h?.clinicName} · Today is {h?.today ?? sgToday()} (Singapore). <LiveStamp at={at} /></p>
      </div>

      {!h ? (
        <p className="text-faint">Loading…</p>
      ) : (
        <>
          <section className="card space-y-3">
            <h2 className="font-semibold text-accent-text">Today&apos;s schedule</h2>
            {h.next && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-info-soft p-3">
                <p><b>Next patient:</b> {h.next.patientName}{h.next.time ? ` at ${h.next.time}` : ""}</p>
                <Link href={`/doctor/brief?id=${encodeURIComponent(h.next.id)}`} className="btn-primary py-2 text-sm">View brief</Link>
              </div>
            )}
            {h.schedule.length === 0 ? (
              <p className="text-muted">No appointments today.</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {h.schedule.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span><b>{r.time ?? "time not set"}</b> · {r.patientName}</span>
                    <span className="chip bg-raised text-muted">{STATUS[r.status] ?? r.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card space-y-2">
            <h2 className="font-semibold text-accent-text">Patient requests</h2>
            {h.requests.total === 0 ? (
              <p className="text-muted">No requests yet. A patient appears after they book here and share their summary.</p>
            ) : (
              <p>
                <b className="text-2xl">{h.requests.new}</b> new request{h.requests.new === 1 ? "" : "s"}
                {h.requests.changed > 0 && <> · <b>{h.requests.changed}</b> with new changes</>} · {h.requests.total} in total
              </p>
            )}
            <p className="text-xs text-faint">{h.requests.updatedAt ? `Last update ${ago(h.requests.updatedAt)}` : ""}</p>
            <Link href="/requests" className="text-sm text-accent-text underline">Open patient requests</Link>
          </section>

          <section className="card space-y-2">
            <h2 className="font-semibold text-accent-text">Follow-ups</h2>
            <p><b className="text-2xl text-bad">{h.followUps.overdue}</b> overdue · <b className="text-2xl">{h.followUps.dueThisWeek}</b> due this week</p>
            {h.followUps.top.length === 0 ? (
              <p className="text-muted">Nothing overdue or due this week.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {h.followUps.top.map((f) => (
                  <li key={`${f.shareId}-${f.test}-${f.dueDate}`}>
                    <Link href={`/doctor/patient?id=${encodeURIComponent(f.shareId)}`} className="underline">{f.patientName}</Link> · {f.test} · due {f.dueDate}
                    {f.bucket === "overdue" && <span className="chip ml-2 bg-bad-soft text-xs text-bad">overdue</span>}
                  </li>
                ))}
              </ul>
            )}
            <Link href="/doctor/followups" className="text-sm text-accent-text underline">Open follow-ups</Link>
          </section>

          <section className="card space-y-2">
            <h2 className="font-semibold text-accent-text">Recently changed</h2>
            {h.recent.length === 0 ? (
              <p className="text-muted">No recent changes from patients who have shared with this clinic.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {h.recent.map((r) => (
                  <li key={r.shareId}>
                    <Link href={`/doctor/patient?id=${encodeURIComponent(r.shareId)}`} className="underline">{r.patientName}</Link> {r.what} · {ago(r.at)}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="flex flex-wrap gap-2">
            <Link href="/requests" className="btn-secondary">Patient requests</Link>
            <Link href="/doctor" className="btn-secondary">Schedule</Link>
            <Link href="/doctor/followups" className="btn-secondary">Follow-ups</Link>
          </div>
        </>
      )}
    </div>
  );
}
