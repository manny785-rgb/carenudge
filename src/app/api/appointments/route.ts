import { z } from "zod";
import { getCaseRow, saveCaseRow } from "@/lib/dbstore";
import { flagFor, markViewed, readDb, recordChange, touch, syncSharesFromCase, scheduleForDoctor, shareForOps, sharesForOps, writeDb, type Role, type Share } from "@/lib/db";
import { requireStaff } from "@/lib/session";

// The clinic schedule. Rows contain logistics only (patient name, date, time, status): no
// summary, nudges or results, so the same data is safe for both clinic roles.
//  - doctor: read-only. A cancelled appointment stays as a logistics-only row (no patient or report access).
//  - clinic_ops: everything for the clinic, and may reschedule, cancel or mark a no-show.

/** The last cancel or reschedule, and whether this role has acknowledged it. */
const changeView = (s: Share, role: Role) =>
  s.change ? { kind: s.change.kind, by: s.change.by, at: s.change.at, fromDate: s.change.fromDate, fromTime: s.change.fromTime, unseen: !s.change.seen[role === "doctor" ? "doctor" : "ops"] } : null;

export async function GET() {
  const auth = await requireStaff("doctor", "clinic_ops");
  if (auth instanceof Response) return auth;
  const db = await readDb();

  const shares = auth.role === "clinic_ops" ? sharesForOps(db, auth) : scheduleForDoctor(db, auth);
  const appointments = shares
    // Doctors also get how many documents the patient shared (a count only). Ops never do.
    .map((s) => ({
      id: s.id,
      patientName: s.patientName,
      date: s.appointmentDate,
      time: s.appointmentTime,
      status: s.appointmentStatus,
      ...(auth.role === "doctor" && s.appointmentStatus !== "cancelled" ? { reportCount: s.snapshot.reports?.length ?? 0 } : {}),
      change: changeView(s, auth.role),
      flag: flagFor(s, auth.id),
    }))
    .sort((a, b) => `${a.date} ${a.time ?? ""}`.localeCompare(`${b.date} ${b.time ?? ""}`));
  return Response.json({ appointments, role: auth.role });
}

const Body = z.object({
  shareId: z.string(),
  action: z.enum(["reschedule", "cancel", "no_show"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
});

/** Operations only: reschedule, cancel, or mark a no-show. */
export async function PATCH(req: Request) {
  const auth = await requireStaff("clinic_ops");
  if (auth instanceof Response) return auth;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid data." }, { status: 400 });
  const { shareId, action, date, time } = parsed.data;

  const db = await readDb();
  const share = shareForOps(db, auth, shareId);
  if (!share) return Response.json({ error: "Not found." }, { status: 404 });

  touch(share);
  markViewed(share, auth.id); // the person who made the change has seen it
  if (action === "reschedule" || action === "cancel") recordChange(share, action === "cancel" ? "cancelled" : "rescheduled", "clinic");
  if (action === "reschedule") {
    if (!date) return Response.json({ error: "Pick a new date." }, { status: 400 });
    share.appointmentDate = date;
    share.appointmentTime = time ?? null;
    share.appointmentStatus = "scheduled";
  } else {
    share.appointmentStatus = action === "cancel" ? "cancelled" : "no_show";
  }
  // The patient's own check is the source of truth, so a clinic-side move is written there too (otherwise the
  // patient's next save would undo it). A cancel or no-show leaves their booking in place: it shows as "cancelled
  // by the clinic" next to the clinic's record, and rescheduling it later revives the same booking.
  const owned = share.bookingId && action === "reschedule" ? await getCaseRow(share.snapshot.id) : null;
  if (owned && owned.patientId === share.patientId) {
    const c = owned.case;
    c.followUps = c.followUps.map((f) => {
      if (f.id !== share.bookingId) return f;
      const { time: _old, ...rest } = f; // eslint-disable-line @typescript-eslint/no-unused-vars
      return { ...rest, dueDate: share.appointmentDate, ...(share.appointmentTime ? { time: share.appointmentTime } : {}) };
    });
    await saveCaseRow(owned);
    syncSharesFromCase(db, share.patientId, c);
  }
  await writeDb(db);
  return Response.json({ ok: true });
}

/** "Got it": the doctor or operations user acknowledges a new booking or change on their clinic's schedule. */
export async function PUT(req: Request) {
  const auth = await requireStaff("doctor", "clinic_ops");
  if (auth instanceof Response) return auth;

  const shareId = ((await req.json().catch(() => null)) as { shareId?: string } | null)?.shareId;
  const db = await readDb();
  const share = (auth.role === "doctor" ? scheduleForDoctor(db, auth) : sharesForOps(db, auth)).find((s) => s.id === shareId);
  if (!share) return Response.json({ error: "Not found." }, { status: 404 });
  if (share.change) share.change.seen[auth.role === "doctor" ? "doctor" : "ops"] = true;
  markViewed(share, auth.id);
  await writeDb(db);
  return Response.json({ ok: true });
}
