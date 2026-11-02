import { readDb, writeDb } from "@/lib/db";
import { ClinicProfileSchema } from "@/lib/schemas";
import { requireStaff } from "@/lib/session";

// Clinic operations edit only their own clinic (taken from their server-side profile, never the
// request). Doctors get 403 here.

export async function GET() {
  const auth = await requireStaff("clinic_ops");
  if (auth instanceof Response) return auth;
  const clinic = await (await readDb()).clinics.find((c) => c.id === auth.clinicId);
  if (!clinic) return Response.json({ error: "Choose your clinic first." }, { status: 404 });
  return Response.json({ clinic });
}

export async function PATCH(req: Request) {
  const auth = await requireStaff("clinic_ops");
  if (auth instanceof Response) return auth;

  const parsed = ClinicProfileSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid data." }, { status: 400 });

  const db = await readDb();
  const clinic = db.clinics.find((c) => c.id === auth.clinicId);
  if (!clinic) return Response.json({ error: "Choose your clinic first." }, { status: 404 });

  const { hours, services, languages, address, phone } = parsed.data;
  // Keep periods in time order; numeric keys match the Clinic type.
  clinic.hours = Object.fromEntries(Object.entries(hours).map(([d, ps]) => [Number(d), [...ps].sort((a, b) => a[0].localeCompare(b[0]))]));
  clinic.services = services;
  clinic.languages = languages;
  clinic.address = address || undefined;
  clinic.phone = phone || undefined;
  await writeDb(db);
  return Response.json({ clinic });
}
