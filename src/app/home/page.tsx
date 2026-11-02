"use client";

import Link from "next/link";
import { useCallback } from "react";
import { useSession } from "@/components/Session";
import { UrgentCare } from "@/components/UrgentCare";
import type { Clinic } from "@/lib/clinics";
import { openStatus, useNow } from "@/lib/hours";
import { sgToday } from "@/lib/sgtime";
import { useHydrated, useStore } from "@/lib/storage";
import { useLive } from "@/lib/useLive";
import type { CareCase, FollowUp } from "@/lib/types";
import { Icon } from "@/components/ui/Icon";

interface ShareView {
  id: string;
  clinicName: string;
  appointmentStatus: string;
  expiresAt: string;
}

const longDate = (iso: string) => new Date(`${iso}T12:00:00+08:00`).toLocaleDateString("en-SG", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Singapore" });

/** A Google Calendar "add event" link for a booking (opens Google's own page; nothing is sent by CareNudge). */
function calendarUrl(title: string, date: string, time?: string): string {
  const compact = (iso: string) => iso.replace(/-/g, "");
  let dates: string;
  if (time) {
    // A one-hour event in Singapore time ("YYYYMMDDTHHMMSS", with ctz below).
    const local = (t: Date) => new Date(t.getTime() + 8 * 3_600_000).toISOString().replace(/[-:]/g, "").split(".")[0];
    const start = new Date(`${date}T${time}:00+08:00`);
    dates = `${local(start)}/${local(new Date(start.getTime() + 3_600_000))}`;
  } else {
    // An all-day event ends on the following day.
    const nextDay = new Date(new Date(`${date}T00:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10);
    dates = `${compact(date)}/${compact(nextDay)}`;
  }
  const u = new URL("https://calendar.google.com/calendar/r/eventedit");
  u.searchParams.set("text", title);
  u.searchParams.set("dates", dates);
  u.searchParams.set("ctz", "Asia/Singapore");
  return u.toString();
}

export default function PatientHomePage() {
  return useHydrated() ? <PatientHome /> : null;
}

/** Patient home: reads my saved checks, my shares and my clinic from the database. Nothing here is hard-coded. */
function PatientHome() {
  const { user } = useSession();
  const cases: CareCase[] = useStore()?.cases ?? [];
  const now = useNow();
  const today = sgToday();

  const fetchShares = useCallback(async () => ((await (await fetch("/api/shares", { cache: "no-store" })).json()).shares ?? []) as ShareView[], []);
  const { data: shares } = useLive(fetchShares);
  const fetchClinic = useCallback(async () => {
    const list = ((await (await fetch("/api/clinics", { cache: "no-store" })).json()).clinics ?? []) as Clinic[];
    return list.find((c) => c.id === user?.clinicId) ?? null;
  }, [user?.clinicId]);
  const { data: clinic } = useLive(fetchClinic);

  // The current nudge: from my newest check that has been through the rules engine.
  const current = cases.find((c) => c.rules) ?? null;
  const nudge = current?.rules?.nudges[0] ?? null;

  // My next booking at any saved check.
  const bookings = cases
    .flatMap((c) => c.followUps.filter((f) => f.createdBy === "patient" && f.status === "booked" && f.dueDate >= today).map((f) => ({ c, f })))
    .sort((a, b) => `${a.f.dueDate} ${a.f.time ?? ""}`.localeCompare(`${b.f.dueDate} ${b.f.time ?? ""}`));
  const next: { c: CareCase; f: FollowUp } | undefined = bookings[0];
  const nextClinic = next && clinic && next.f.where === clinic.name ? clinic : null;
  const status = nextClinic ? openStatus(nextClinic, now) : null;

  const first = user?.name.split(" ")[0] ?? "";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-bold text-accent-text">Hello, {first}</h1>
        <p className="text-muted">{longDate(today)}</p>
      </div>

      {/* The current nudge. Never a green tick or an all-clear. */}
      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-accent-text">My current reminder</h2>
          {nudge && <span className="not-diagnosis">Not a diagnosis</span>}
        </div>
        {nudge && current ? (
          <>
            <p className="text-xl font-bold">{nudge.title}</p>
            <p className="text-muted">{nudge.reason}</p>
            <a href={nudge.source.url} target="_blank" rel="noreferrer" className="chip bg-raised text-accent-text underline">Source: {nudge.source.name} <Icon name="external" className="h-3 w-3" /></a>
            <div>
              {next ? (
                <Link href={`/intake?case=${current.id}`} className="btn-primary pulse-soft w-full sm:w-auto">See why</Link>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <Link href="/appointments" className="btn-primary pulse-soft w-full sm:w-auto">Book a screening</Link>
                  <Link href={`/intake?case=${current.id}`} className="text-sm text-accent-text underline">See why</Link>
                </div>
              )}
            </div>
          </>
        ) : current ? (
          <>
            <p className="text-ink">No screening reminders right now. This is not a health check. If you feel unwell, see a doctor.</p>
            <Link href={`/intake?case=${current.id}`} className="btn-secondary">Review my check</Link>
          </>
        ) : (
          <>
            <p className="text-muted">You haven&apos;t done a check yet. It takes a few minutes and you confirm everything before any reminder is shown.</p>
            <Link href="/intake" className="btn-primary w-full sm:w-auto">Start my check</Link>
          </>
        )}
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold text-accent-text">Next appointment</h2>
        {next ? (
          <>
            <p className="text-lg font-bold">{next.f.test}</p>
            <p>{next.f.where} · {longDate(next.f.dueDate)}{next.f.time ? ` at ${next.f.time}` : ""}</p>
            {status && <p className={`text-sm font-semibold ${status.open ? "text-ok" : "text-bad"}`}>{status.label}</p>}
            <div className="flex flex-wrap gap-2 pt-1">
              <a className="btn-secondary py-2 text-sm" target="_blank" rel="noreferrer" href={calendarUrl(`${next.f.test} at ${next.f.where}`, next.f.dueDate, next.f.time)}>Add to Google Calendar</a>
              <Link href="/appointments" className="btn-secondary py-2 text-sm">Manage appointments</Link>
            </div>
          </>
        ) : (
          <>
            <p className="text-muted">No upcoming appointment.</p>
            <Link href={user?.clinicId ? "/appointments" : "/choose-clinic"} className="btn-primary w-full sm:w-auto">Book a clinic</Link>
          </>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { href: current ? `/intake?case=${current.id}` : "/intake", icon: "clipboard" as const, label: "Update my history" },
          { href: "/labelspeak", icon: "tag" as const, label: "LabelSpeak" },
          { href: "/reports", icon: "file" as const, label: "My reports" },
          { href: "/choose-clinic", icon: "clinic" as const, label: "Change clinic" },
        ].map((a) => (
          <Link key={a.label} href={a.href} className="card flex flex-col items-center gap-1 py-4 text-center text-sm font-semibold hover:bg-raised">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent-soft text-accent-text"><Icon name={a.icon} className="h-6 w-6" /></span>
            {a.label}
          </Link>
        ))}
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold text-accent-text">Who can see my information</h2>
        {shares === null ? (
          <p className="text-faint">Loading…</p>
        ) : shares.length === 0 ? (
          <p className="text-muted">No clinic can see your information right now. A clinic sees your summary only if you book there and choose to share it.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {shares.map((s) => (
              <li key={s.id}>
                <b>{s.clinicName}</b> can see your shared summary until {new Date(s.expiresAt).toLocaleDateString("en-SG")}.
              </li>
            ))}
          </ul>
        )}
        <Link href="/privacy" className="text-sm text-accent-text underline">Manage or stop sharing</Link>
      </section>

      {/* Urgent care (with the fixed urgent-symptom wording) is never behind anything and always visible. */}
      <UrgentCare title="Nearby 24-hour emergency options" origin={null} />
    </div>
  );
}
