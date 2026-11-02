"use client";

import Link from "next/link";
import { useCallback } from "react";
import { LiveStamp } from "@/components/LiveStamp";
import { useLive } from "@/lib/useLive";
import { CLINICS } from "@/lib/clinics";
import { useSession } from "@/components/Session";

interface Row {
  id: string;
  patientName: string;
  appointmentDate: string;
  status: "new" | "reviewed" | "follow_up_set";
  nudgeCount: number;
  reportCount: number;
  /** "new": never opened by this doctor. "changed": the patient changed something since they last opened it. */
  flag: "new" | "changed" | null;
}

const STATUS: Record<Row["status"], { label: string; cls: string }> = {
  new: { label: "New", cls: "bg-info-soft text-info" },
  reviewed: { label: "Reviewed", cls: "bg-ok-soft text-ok" },
  follow_up_set: { label: "Follow-up set", cls: "bg-warn-soft text-warn" },
};

// The server returns only requests for this doctor's clinic; nothing is filtered in the browser.
export default function RequestsPage() {
  const { user } = useSession();
  const clinic = CLINICS.find((c) => c.id === user?.clinicId);
  // Fresh every 12 seconds and when the tab is shown: new requests, patient changes and revoked shares appear without a refresh.
  const fetchRows = useCallback(async () => {
    const res = await fetch("/api/requests", { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    return ((await res.json()).requests ?? []) as Row[];
  }, []);
  const { data: rows, at } = useLive(fetchRows);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-bold text-accent-text">Patient requests</h1>
        <p className="text-muted">
          {clinic?.name}. Only patients who booked here and agreed to share appear. <LiveStamp at={at} />
        </p>
      </div>

      {rows === null ? (
        <p className="text-faint">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="card text-muted">No requests yet. A patient appears here after they book at this clinic and share their summary.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="card flex flex-wrap items-center justify-between gap-3">
              <Link href={`/doctor/patient?id=${encodeURIComponent(r.id)}`} className="min-w-48 flex-1 hover:underline">
                <p className="font-semibold">
                  {r.patientName}
                  {r.flag && <span className="chip ml-2 bg-bad-soft align-middle text-xs text-bad">{r.flag === "new" ? "New request" : "New changes"}</span>}
                </p>
                <p className="text-sm text-muted">Appointment {r.appointmentDate} · {r.nudgeCount} nudge{r.nudgeCount === 1 ? "" : "s"}</p>
              </Link>
              <span className={`chip ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
              <Link href={`/doctor/brief?id=${encodeURIComponent(r.id)}`} className="btn-secondary py-2 text-sm">View brief</Link>
              <Link href={`/doctor/patient?id=${encodeURIComponent(r.id)}&tab=reports`} className="btn-secondary py-2 text-sm">Reports ({r.reportCount})</Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
