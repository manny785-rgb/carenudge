import { readDb, sharesForOps } from "@/lib/db";
import { bucketOf } from "@/lib/followups";
import { planOf } from "@/lib/plans";
import { requireStaff } from "@/lib/session";
import { sgToday } from "@/lib/sgtime";

// Clinic dashboard numbers, counted only from this clinic's active, consented shares.
// Nothing is estimated or benchmarked: every figure is a count or an average of stored data.

export async function GET() {
  const auth = await requireStaff("clinic_ops");
  if (auth instanceof Response) return auth;

  const db = await readDb();
  // The dashboard is a Pro feature (enforced here, not just hidden in the page).
  const clinic = db.clinics.find((c) => c.id === auth.clinicId);
  if (!clinic || planOf(clinic) !== "pro") return Response.json({ error: "The dashboard is part of the Pro plan.", upgrade: true }, { status: 402 });
  // Aggregates only: counts and averages, never per-patient clinical data.
  const all = sharesForOps(db, auth);
  const shares = all.filter((s) => s.appointmentStatus !== "cancelled");
  const today = sgToday();

  const followUps = shares.flatMap((s) => s.snapshot.followUps);
  const bucket = (b: string) => followUps.filter((f) => bucketOf(f.status, f.dueDate, today) === b).length;

  const prep = shares.map((s) => s.prepSeconds).filter((n): n is number => n !== null);
  const patientIds = new Set(shares.map((s) => s.patientId));
  const tb = db.teachBack.filter((t) => patientIds.has(t.patientId));

  return Response.json({
    today,
    bookedAndShared: shares.length,
    nudgedAndShared: shares.filter((s) => (s.snapshot.rules?.nudges.length ?? 0) > 0).length,
    followUps: { total: followUps.length, done: bucket("done"), overdue: bucket("overdue"), dueThisWeek: bucket("due_week"), upcoming: bucket("upcoming") },
    // Appointments marked no-show by operations, plus follow-ups marked missed.
    noShows: all.filter((s) => s.appointmentStatus === "no_show").length + followUps.filter((f) => f.status === "missed").length,
    prep: { n: prep.length, avgSeconds: prep.length ? Math.round(prep.reduce((a, b) => a + b, 0) / prep.length) : null },
    teachBack: { n: tb.length, bothCorrect: tb.filter((t) => t.whyCorrect && t.actionCorrect).length },
  });
}
