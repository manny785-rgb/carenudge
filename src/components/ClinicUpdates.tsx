"use client";

import { useCallback } from "react";
import { LiveStamp } from "@/components/LiveStamp";
import { useLive } from "@/lib/useLive";
import type { FollowUp } from "@/lib/types";

interface ShareView {
  id: string;
  clinicName: string;
  appointmentDate: string;
  appointmentTime: string | null;
  appointmentStatus: "scheduled" | "cancelled" | "no_show" | "completed";
  followUps: FollowUp[];
}

/** What a clinic has added for the patient: its follow-ups and simulated reminders (demo). */
export function ClinicUpdates() {
  // Fresh every 12 seconds and when the tab is shown, so a reminder or a new follow-up appears without a refresh.
  const fetchShares = useCallback(async () => {
    const res = await fetch("/api/shares", { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    return ((await res.json()).shares ?? []) as ShareView[];
  }, []);
  const { data, at } = useLive(fetchShares);
  const shares = data ?? [];

  // What the clinic added to a follow-up: its own plan items, and any reminder (even on a booking I made myself).
  const clinicItems = (s: ShareView) => s.followUps.filter((f) => f.createdBy === "doctor" || (f.reminders?.length ?? 0) > 0);
  // Show a clinic if it added items, or changed the appointment (cancelled, rescheduled, no-show).
  const withDoctorItems = shares.filter((s) => clinicItems(s).length > 0 || s.appointmentStatus !== "scheduled");
  if (!withDoctorItems.length) return null;

  return (
    <section className="card space-y-3">
      <h2 className="font-bold">From my clinic <LiveStamp at={at} /></h2>
      {withDoctorItems.map((s) => (
        <div key={s.id} className="space-y-2">
          <p className="text-sm font-semibold text-accent-text">{s.clinicName}</p>
          <p className="text-sm">
            Appointment {s.appointmentDate}
            {s.appointmentTime ? ` at ${s.appointmentTime}` : ""} · {s.appointmentStatus.replace("_", "-")}
          </p>
          <ul className="space-y-2 text-sm">
            {clinicItems(s).map((f) => (
              <li key={f.id} className="rounded-lg bg-raised px-3 py-2">
                <span className="font-medium">{f.test}</span> · due {f.dueDate} · {f.status}
                {f.doneDate && ` (done ${f.doneDate})`}
                {f.reminders && f.reminders.length > 0 && (
                  <span className="block text-xs text-muted">
                    Reminder from {s.clinicName} (demo, nothing was sent) · {new Date(f.reminders[f.reminders.length - 1]).toLocaleString()}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
