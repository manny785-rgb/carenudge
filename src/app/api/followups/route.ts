import { z } from "zod";
import { logAccess, readDb, shareForDoctor, shareForOps, sharesForDoctor, sharesForOps, writeDb } from "@/lib/db";
import { bucketOf } from "@/lib/followups";
import { requireStaff } from "@/lib/session";
import { sgToday } from "@/lib/sgtime";

// Follow-up board data for the staff member's own clinic.
//  - doctor: the clinical follow-up (test name) and may mark it done.
//  - clinic_ops: logistics only. The test name is replaced with a generic "Follow-up" and
//    no results or notes are returned. Ops may reschedule or send a demo reminder, not mark done.

export async function GET() {
  const auth = await requireStaff("doctor", "clinic_ops");
  if (auth instanceof Response) return auth;
  const today = sgToday();
  const db = await readDb();
  const isOps = auth.role === "clinic_ops";

  const items = (isOps ? sharesForOps(db, auth) : sharesForDoctor(db, auth)).flatMap((s) =>
    s.snapshot.followUps.map((f) => ({
      shareId: s.id,
      followUpId: f.id,
      patientName: s.patientName,
      test: isOps ? "Follow-up" : f.test,
      dueDate: f.dueDate,
      status: f.status,
      doneDate: f.doneDate ?? null,
      reminders: f.reminders ?? [],
      bucket: bucketOf(f.status, f.dueDate, today),
    })),
  );
  items.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return Response.json({ items, today, role: auth.role });
}

const Body = z.object({
  shareId: z.string(),
  followUpId: z.string(),
  action: z.enum(["done", "reschedule", "reminder"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/** Mark done (doctor only), reschedule, or record a simulated reminder. No real message is sent. */
export async function PATCH(req: Request) {
  const auth = await requireStaff("doctor", "clinic_ops");
  if (auth instanceof Response) return auth;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid data." }, { status: 400 });
  const { shareId, followUpId, action, date } = parsed.data;
  if (auth.role === "clinic_ops" && action === "done") return Response.json({ error: "Only a doctor can mark a follow-up done." }, { status: 403 });

  const db = await readDb();
  const share = auth.role === "doctor" ? shareForDoctor(db, auth, shareId) : shareForOps(db, auth, shareId);
  const f = share?.snapshot.followUps.find((x) => x.id === followUpId);
  if (!share || !f) return Response.json({ error: "Not found." }, { status: 404 });

  if (action === "done") {
    f.status = "done";
    f.doneDate = date ?? sgToday();
  } else if (action === "reschedule") {
    if (!date) return Response.json({ error: "Pick a new date." }, { status: 400 });
    f.dueDate = date;
    if (f.status === "done" || f.status === "missed") f.status = "planned";
    delete f.doneDate;
  } else {
    f.reminders = [...(f.reminders ?? []), new Date().toISOString()];
    logAccess(db, auth, share, "sent_reminder"); // visible in the clinic's and the patient's access log
  }
  await writeDb(db);
  return Response.json({ ok: true });
}
