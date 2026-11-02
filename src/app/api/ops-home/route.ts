import { readDb, sharesForOps } from "@/lib/db";
import { bucketOf } from "@/lib/followups";
import { requireUser } from "@/lib/session";
import { addDays, sgToday } from "@/lib/sgtime";

// Everything on the operations home page, for the signed-in user's own clinic only. Logistics and
// plain counts: names, dates, times and statuses. No summaries, histories, medicines, results,
// reports, notes or follow-up test names ever leave this route.

export async function GET() {
  const auth = await requireUser("clinic_ops");
  if (auth instanceof Response) return auth;

  const db = await readDb();
  const today = sgToday();
  const weekEnd = addDays(today, 6);
  const shares = sharesForOps(db, auth);
  const clinic = db.clinics.find((c) => c.id === auth.clinicId);
  const row = (s: (typeof shares)[number]) => ({ id: s.id, patientName: s.patientName, date: s.appointmentDate, time: s.appointmentTime, status: s.appointmentStatus });
  const byTime = (a: { date: string; time: string | null }, b: { date: string; time: string | null }) => `${a.date} ${a.time ?? ""}`.localeCompare(`${b.date} ${b.time ?? ""}`);

  const live = shares.filter((s) => s.appointmentStatus !== "cancelled");
  const followUps = live.flatMap((s) => s.snapshot.followUps);
  const recentFrom = addDays(today, -7);

  return Response.json({
    today,
    clinic: clinic ? { name: clinic.name, area: clinic.area, address: clinic.address ?? null, phone: clinic.phone ?? null, todayHours: clinic.hours[new Date(`${today}T12:00:00+08:00`).getUTCDay()] ?? [] } : null,
    todayRows: shares.filter((s) => s.appointmentDate === today).map(row).sort(byTime),
    // Past no-shows (last 7 days) and cancellations dated today or later, so reception can follow up or rebook.
    attention: shares
      .filter((s) => (s.appointmentStatus === "no_show" && s.appointmentDate >= recentFrom) || (s.appointmentStatus === "cancelled" && s.appointmentDate >= today))
      .map(row)
      .sort(byTime),
    week: {
      appointments: live.filter((s) => s.appointmentDate >= today && s.appointmentDate <= weekEnd).length,
      noShows: shares.filter((s) => s.appointmentStatus === "no_show" && s.appointmentDate >= recentFrom).length,
    },
    followUps: {
      done: followUps.filter((f) => f.status === "done").length,
      overdue: followUps.filter((f) => bucketOf(f.status, f.dueDate, today) === "overdue").length,
    },
    // How many shared bookings came with a screening reminder. A count only: never who, never which.
    reminders: { sharedBookings: live.length, withReminder: live.filter((s) => (s.snapshot.rules?.nudges.length ?? 0) > 0).length },
  });
}
