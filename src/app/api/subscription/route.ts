import { z } from "zod";
import { readDb, writeDb } from "@/lib/db";
import { FREE_SHARE_LIMIT, planOf, sharedThisMonth } from "@/lib/plans";
import { requireStaff } from "@/lib/session";
import { sgToday } from "@/lib/sgtime";

// The signed-in clinic's own plan (taken from their server-side profile, never the request). Demo only:
// switching plan takes no payment. Doctors get 403 here, like the other clinic-operations routes.

async function view(clinicId: string) {
  const db = await readDb();
  const clinic = db.clinics.find((c) => c.id === clinicId);
  if (!clinic) return null;
  const plan = planOf(clinic);
  return {
    plan,
    planSince: clinic.planSince ?? null,
    usage: { month: sgToday().slice(0, 7), sharedPatients: sharedThisMonth(db.shares, clinicId, sgToday().slice(0, 7)).size, limit: plan === "free" ? FREE_SHARE_LIMIT : null },
  };
}

export async function GET() {
  const auth = await requireStaff("clinic_ops");
  if (auth instanceof Response) return auth;
  const out = await view(auth.clinicId);
  return out ? Response.json(out) : Response.json({ error: "Choose your clinic first." }, { status: 404 });
}

export async function POST(req: Request) {
  const auth = await requireStaff("clinic_ops");
  if (auth instanceof Response) return auth;
  const parsed = z.object({ plan: z.enum(["free", "pro"]) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Choose Free or Pro." }, { status: 400 });

  const db = await readDb();
  const clinic = db.clinics.find((c) => c.id === auth.clinicId);
  if (!clinic) return Response.json({ error: "Choose your clinic first." }, { status: 404 });
  if (planOf(clinic) !== parsed.data.plan) {
    clinic.plan = parsed.data.plan;
    clinic.planSince = new Date().toISOString();
    await writeDb(db);
  }
  return Response.json(await view(auth.clinicId));
}
