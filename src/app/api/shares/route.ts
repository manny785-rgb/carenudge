import { z } from "zod";
import { deriveSnapshot, expiryFor, isActive, newId, readDb, writeDb, type Share } from "@/lib/db";
import { getCaseRow } from "@/lib/dbstore";
import { requireUser } from "@/lib/session";

// Patient-side sharing. Every handler is scoped to the signed-in patient. A share is the clinic's
// copy of one of the patient's saved checks (see /api/cases, which keeps it up to date).

const Body = z.object({
  consent: z.literal(true),
  caseId: z.string().max(64),
  appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** My shares that a clinic can currently see. */
export async function GET() {
  const auth = await requireUser("patient");
  if (auth instanceof Response) return auth;

  const db = await readDb();
  const shares = db.shares
    .filter((s) => s.patientId === auth.id && isActive(s))
    .map((s) => ({
      id: s.id,
      caseId: s.snapshot.id,
      bookingId: s.bookingId ?? null,
      clinicId: s.clinicId,
      clinicName: db.clinics.find((c) => c.id === s.clinicId)?.name ?? "Unknown clinic",
      // What the clinic has added, so the patient can see it (follow-ups and reminders).
      followUps: s.snapshot.followUps,
      // Which documents this clinic can currently see, so the patient's buttons match reality.
      sharedReportIds: (s.snapshot.reports ?? []).map((r) => r.id),
      appointmentDate: s.appointmentDate,
      appointmentTime: s.appointmentTime,
      appointmentStatus: s.appointmentStatus,
      sharedAt: s.sharedAt,
      expiresAt: s.expiresAt,
    }));
  return Response.json({ shares });
}

/** Share one of my saved checks with my current clinic. Needs explicit consent and a booking at that clinic. */
export async function POST(req: Request) {
  const auth = await requireUser("patient");
  if (auth instanceof Response) return auth;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Consent and a confirmed check are required." }, { status: 400 });
  const { caseId, appointmentDate } = parsed.data;

  // The check comes from the database, never from the request, and must be mine.
  const owned = await getCaseRow(caseId);
  const c = owned?.patientId === auth.id ? owned.case : null;
  if (!c || !c.summary || !c.rules || !c.confirmedAt) return Response.json({ error: "Confirm your check before sharing it." }, { status: 400 });

  const db = await readDb();
  const clinic = db.clinics.find((x) => x.id === auth.clinicId);
  if (!clinic) return Response.json({ error: "Choose a clinic first." }, { status: 400 });

  const booked = c.followUps.find((f) => f.createdBy === "patient" && f.status === "booked" && f.dueDate === appointmentDate && f.where === clinic.name);
  if (!booked) return Response.json({ error: `Book an appointment with ${clinic.name} before sharing.` }, { status: 400 });

  const now = new Date().toISOString();
  // One live share per patient per clinic. Replace the old one but keep what the clinic added.
  const previous = db.shares.find((s) => s.patientId === auth.id && s.clinicId === clinic.id && isActive(s));
  for (const s of db.shares) {
    if (s.patientId === auth.id && (s.snapshot.id === c.id || s.clinicId === clinic.id) && !s.revokedAt) s.revokedAt = now;
  }
  const share: Share = {
    id: newId(),
    patientId: auth.id,
    patientName: auth.name,
    clinicId: clinic.id,
    bookingId: booked.id,
    appointmentDate,
    appointmentTime: booked.time ?? null,
    appointmentStatus: "scheduled",
    sharedAt: now,
    updatedAt: now,
    viewedBy: previous?.viewedBy, // a re-share shows up as changed, not as a brand new request
    expiresAt: expiryFor(appointmentDate),
    revokedAt: null,
    status: previous?.status ?? "new",
    firstOpenedAt: previous?.firstOpenedAt ?? null,
    prepSeconds: previous?.prepSeconds ?? null,
    snapshot: deriveSnapshot(c, previous?.snapshot),
  };
  db.shares.push(share);
  await writeDb(db);
  return Response.json({ shareId: share.id, clinicName: clinic.name, expiresAt: share.expiresAt });
}

/** Revoke access. Only my own shares; the doctor's list drops it immediately. */
export async function DELETE(req: Request) {
  const auth = await requireUser("patient");
  if (auth instanceof Response) return auth;

  const id = new URL(req.url).searchParams.get("id");
  const db = await readDb();
  const share = db.shares.find((s) => s.id === id && s.patientId === auth.id);
  if (!share) return Response.json({ error: "Not found." }, { status: 404 });
  share.revokedAt ??= new Date().toISOString();
  await writeDb(db);
  return Response.json({ ok: true });
}
