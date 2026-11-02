import { z } from "zod";
import { readDb, writeDb } from "@/lib/db";
import { requireUser } from "@/lib/session";

const Body = z.object({ clinicId: z.string() });

/**
 * A patient chooses or changes clinic. Switching revokes every share held by the old clinic in
 * the same write, so the old clinic's staff lose access immediately. Clinic staff cannot use this:
 * their clinic is fixed when they sign up.
 */
export async function PATCH(req: Request) {
  const auth = await requireUser("patient");
  if (auth instanceof Response) return auth;

  const db = await readDb();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !db.clinics.some((c) => c.id === parsed.data.clinicId)) {
    return Response.json({ error: "Unknown clinic." }, { status: 400 });
  }
  const { clinicId } = parsed.data;

  const me = db.users.find((u) => u.id === auth.id)!;
  if (me.role === "patient" && me.clinicId && me.clinicId !== clinicId) {
    const now = new Date().toISOString();
    for (const s of db.shares) {
      if (s.patientId === me.id && s.clinicId !== clinicId && !s.revokedAt) s.revokedAt = now;
    }
  }
  me.clinicId = clinicId;
  await writeDb(db);
  return Response.json({ user: me });
}
