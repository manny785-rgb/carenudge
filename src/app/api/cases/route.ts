import { connection } from "next/server";
import { z } from "zod";
import { readDb, syncSharesFromCase, writeDb } from "@/lib/db";
import { deleteCaseRows, getCaseRow, listCases, saveCaseRow } from "@/lib/dbstore";
import { requireUser } from "@/lib/session";
import type { CareCase } from "@/lib/types";

// A patient's own saved checks (history, bookings, reports). This is the single source of truth:
// the clinic's copy (a share) is re-derived from it on every save, so nothing can drift.
// Every handler is scoped to the signed-in patient; clinics never read this table.

const MAX_REPORT_CHARS = 4_000_000; // base64 per file, about 3 MB of original
const MAX_REPORTS = 10;

const Body = z.object({
  case: z.custom<CareCase>((v) => {
    const c = v as CareCase | null;
    return !!c && typeof c.id === "string" && c.id.length <= 64 && !!c.summary && Array.isArray(c.followUps) && (c.reports ?? []).length <= MAX_REPORTS && (c.reports ?? []).every((r) => typeof r.content === "string" && r.content.length <= MAX_REPORT_CHARS);
  }),
});

export async function GET() {
  await connection();
  const auth = await requireUser("patient");
  if (auth instanceof Response) return auth;
  return Response.json({ cases: await listCases(auth.id) });
}

/** Create or replace one of my checks, then refresh the clinic's copy of it (if I have shared it). */
export async function PUT(req: Request) {
  const auth = await requireUser("patient");
  if (auth instanceof Response) return auth;

  // A save queued by a different user (who signed out or switched a moment ago) must not land in this account.
  const owner = req.headers.get("x-cn-user");
  if (owner && owner !== auth.id) return Response.json({ error: "Signed in as someone else." }, { status: 409 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid check." }, { status: 400 });
  const c = parsed.data.case;

  const existing = await getCaseRow(c.id);
  if (existing && existing.patientId !== auth.id) return Response.json({ error: "Not found." }, { status: 404 }); // someone else's check
  await saveCaseRow({ patientId: auth.id, case: c });

  const db = await readDb();
  syncSharesFromCase(db, auth.id, c);
  await writeDb(db);
  return Response.json({ ok: true });
}

/** Delete one check (?id=) or all of mine (?all=1). Deleting a check also stops sharing it. */
export async function DELETE(req: Request) {
  const auth = await requireUser("patient");
  if (auth instanceof Response) return auth;

  const params = new URL(req.url).searchParams;
  const id = params.get("id");
  if (!id && params.get("all") !== "1") return Response.json({ error: "Nothing to delete." }, { status: 400 });

  await deleteCaseRows(auth.id, id ?? undefined);
  const db = await readDb();
  const now = new Date().toISOString();
  for (const s of db.shares) if (s.patientId === auth.id && !s.revokedAt && (!id || s.snapshot.id === id)) s.revokedAt = now;
  await writeDb(db);
  return Response.json({ ok: true });
}
