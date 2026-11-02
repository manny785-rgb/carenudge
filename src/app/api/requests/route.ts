import { z } from "zod";
import { flagFor, logAccess, markViewed, readDb, shareForDoctor, sharesForDoctor, writeDb } from "@/lib/db";
import { FollowUpSchema } from "@/lib/schemas";
import { requireUser } from "@/lib/session";

// Doctor-side requests. The clinic ALWAYS comes from the signed-in doctor's profile, never from
// the request, and a share from another clinic looks exactly like one that doesn't exist (404).
// All of that lives in shareForDoctor / sharesForDoctor (src/lib/db.ts).

/**
 * No `id`: the list of my clinic's requests.
 * With `id`: one request with the full summary. Opening it is written to the access log.
 * `view=brief` logs it as a brief view instead of a summary view.
 * `poll=1` is the page checking for updates while it is open: no access-log entry, nothing marked seen.
 * `ack=1` is the doctor choosing to look at the new changes: marked seen, no new log entry.
 */
export async function GET(req: Request) {
  const auth = await requireUser("doctor");
  if (auth instanceof Response) return auth;
  const db = await readDb();

  const params = new URL(req.url).searchParams;
  const id = params.get("id");
  if (id) {
    const s = shareForDoctor(db, auth, id);
    if (!s) return Response.json({ error: "Not found." }, { status: 404 });
    const { viewedBy: _others, ...request } = s; // eslint-disable-line @typescript-eslint/no-unused-vars
    if (params.get("poll") === "1") return Response.json({ request });
    if (params.get("ack") !== "1") {
      logAccess(db, auth, s, params.get("view") === "brief" ? "opened_brief" : "opened_summary");
      s.firstOpenedAt ??= new Date().toISOString();
    }
    markViewed(s, auth.id);
    await writeDb(db);
    return Response.json({ request });
  }

  const requests = sharesForDoctor(db, auth)
    .map((s) => ({
      id: s.id,
      patientName: s.patientName,
      appointmentDate: s.appointmentDate,
      appointmentTime: s.appointmentTime,
      status: s.status,
      nudgeCount: s.snapshot.rules?.nudges.length ?? 0,
      reportCount: s.snapshot.reports?.length ?? 0,
      sharedAt: s.sharedAt,
      updatedAt: s.updatedAt ?? s.sharedAt,
      flag: flagFor(s, auth.id),
    }))
    .sort((a, b) => a.appointmentDate.localeCompare(b.appointmentDate));
  return Response.json({ requests, clinicId: auth.clinicId });
}

const Patch = z.object({
  id: z.string(),
  findings: z.object({
    bpSys: z.string().max(10),
    bpDia: z.string().max(10),
    bmi: z.string().max(10),
    hba1c: z.string().max(10),
    fastingGlucose: z.string().max(10),
    notes: z.string().max(2000),
    reviewedAt: z.string().nullable(),
  }),
  followUps: z.array(FollowUpSchema),
});

/** Save exam findings and follow-ups on one of my clinic's requests. */
export async function PATCH(req: Request) {
  const auth = await requireUser("doctor");
  if (auth instanceof Response) return auth;

  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid data." }, { status: 400 });

  const db = await readDb();
  const s = shareForDoctor(db, auth, parsed.data.id);
  if (!s) return Response.json({ error: "Not found." }, { status: 404 });

  s.snapshot.findings = parsed.data.findings;
  s.snapshot.followUps = parsed.data.followUps;
  s.status = parsed.data.followUps.some((f) => f.createdBy === "doctor")
    ? "follow_up_set"
    : parsed.data.findings.reviewedAt
      ? "reviewed"
      : "new";
  // Brief-prep time: first open to first save. Recorded once, used by the clinic dashboard.
  if (s.prepSeconds === null && s.firstOpenedAt) {
    s.prepSeconds = Math.round((Date.now() - new Date(s.firstOpenedAt).getTime()) / 1000);
  }
  await writeDb(db);
  return Response.json({ request: s });
}
