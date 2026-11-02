import { flagFor, readDb, sharesForDoctor } from "@/lib/db";
import { bucketOf } from "@/lib/followups";
import { requireUser } from "@/lib/session";
import { addDays, sgClock, sgToday } from "@/lib/sgtime";

// Everything on the doctor's home page, for the signed-in doctor's own clinic only. It reads the same
// consented, active, not-cancelled shares as the schedule and requests list (sharesForDoctor), so a
// revoked, expired or cancelled patient is absent here too. Names and counts only: no clinical content.

const RECENT_DAYS = 7;

export async function GET() {
  const auth = await requireUser("doctor");
  if (auth instanceof Response) return auth;

  const db = await readDb();
  const today = sgToday();
  const shares = sharesForDoctor(db, auth);
  const nowMin = (() => { const { minutes } = sgClock(new Date()); return minutes; })();
  const toMin = (t: string | null) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : null);

  const schedule = shares
    .filter((s) => s.appointmentDate === today)
    .map((s) => ({ id: s.id, patientName: s.patientName, time: s.appointmentTime, status: s.appointmentStatus }))
    .sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));
  // The next patient: the first scheduled visit today that has not started yet (or has no time set).
  const next = schedule.find((r) => r.status === "scheduled" && (toMin(r.time) === null || toMin(r.time)! >= nowMin)) ?? null;

  const flags = shares.map((s) => flagFor(s, auth.id));
  const stamps = shares.map((s) => s.updatedAt ?? s.sharedAt).sort();

  const items = shares
    .flatMap((s) => s.snapshot.followUps.filter((f) => f.status !== "done").map((f) => ({ shareId: s.id, patientName: s.patientName, test: f.test, dueDate: f.dueDate, bucket: bucketOf(f.status, f.dueDate, today) })))
    .filter((i) => i.bucket === "overdue" || i.bucket === "due_week")
    .sort((a, b) => (a.bucket === b.bucket ? a.dueDate.localeCompare(b.dueDate) : a.bucket === "overdue" ? -1 : 1));

  const since = addDays(today, -RECENT_DAYS);
  const recent = shares
    .filter((s) => s.updatedAt && s.updatedAt > s.sharedAt && s.updatedAt.slice(0, 10) >= since)
    .sort((a, b) => b.updatedAt!.localeCompare(a.updatedAt!))
    .slice(0, 5)
    .map((s) => ({
      shareId: s.id,
      patientName: s.patientName,
      at: s.updatedAt!,
      // Says what kind of change, never what it contains.
      what: s.change && Math.abs(new Date(s.change.at).getTime() - new Date(s.updatedAt!).getTime()) < 2000 ? `${s.change.kind} their appointment` : "updated what they shared",
    }));

  return Response.json({
    today,
    clinicName: db.clinics.find((c) => c.id === auth.clinicId)?.name ?? "",
    schedule,
    next,
    requests: { total: shares.length, new: flags.filter((f) => f === "new").length, changed: flags.filter((f) => f === "changed").length, updatedAt: stamps[stamps.length - 1] ?? null },
    followUps: { overdue: items.filter((i) => i.bucket === "overdue").length, dueThisWeek: items.filter((i) => i.bucket === "due_week").length, top: items.slice(0, 3) },
    recent,
  });
}
