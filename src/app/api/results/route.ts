import { z } from "zod";
import { newId, readDb, shareForDoctor, writeDb } from "@/lib/db";
import { TestResultSchema } from "@/lib/schemas";
import { requireUser } from "@/lib/session";

// The doctor saves lab values on a patient's request. Only this route can mark a value
// "doctor-confirmed"; values coming from the patient are always stored as "patient-reported".

const Post = z.object({ shareId: z.string(), result: TestResultSchema.omit({ id: true }) });

export async function POST(req: Request) {
  const auth = await requireUser("doctor");
  if (auth instanceof Response) return auth;

  const parsed = Post.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Please give a test name, a number, a unit and a date." }, { status: 400 });

  const db = await readDb();
  const share = shareForDoctor(db, auth, parsed.data.shareId);
  if (!share) return Response.json({ error: "Not found." }, { status: 404 });

  // A value can only point at a report this patient actually shared with this clinic.
  const reportId = share.snapshot.reports?.some((r) => r.id === parsed.data.result.reportId) ? parsed.data.result.reportId : undefined;
  const result = { ...parsed.data.result, reportId, id: newId(), source: "doctor-confirmed" as const };
  share.snapshot.results = [...(share.snapshot.results ?? []), result];
  await writeDb(db);
  return Response.json({ result });
}

/** Remove a doctor-confirmed value entered by mistake. Patient-reported values are not removable here. */
export async function DELETE(req: Request) {
  const auth = await requireUser("doctor");
  if (auth instanceof Response) return auth;

  const params = new URL(req.url).searchParams;
  const db = await readDb();
  const share = shareForDoctor(db, auth, params.get("shareId"));
  if (!share) return Response.json({ error: "Not found." }, { status: 404 });

  const id = params.get("id");
  share.snapshot.results = (share.snapshot.results ?? []).filter((r) => !(r.id === id && r.source === "doctor-confirmed"));
  await writeDb(db);
  return Response.json({ ok: true });
}
