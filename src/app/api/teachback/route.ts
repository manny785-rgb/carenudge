import { z } from "zod";
import { readDb, writeDb } from "@/lib/db";
import { requireUser } from "@/lib/session";

// A patient's answer to the "did the nudge make sense" check. Stored with their user id so a
// clinic dashboard can count it only while that patient has an active share with the clinic.

const Body = z.object({ ruleId: z.string().max(40), whyCorrect: z.boolean(), actionCorrect: z.boolean() });

export async function POST(req: Request) {
  const auth = await requireUser("patient");
  if (auth instanceof Response) return auth;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid data." }, { status: 400 });

  const db = await readDb();
  db.teachBack.push({ patientId: auth.id, ...parsed.data, at: new Date().toISOString() });
  await writeDb(db);
  return Response.json({ ok: true });
}
