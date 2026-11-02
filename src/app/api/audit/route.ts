import { isActive, readDb, type Share } from "@/lib/db";
import { requireUser } from "@/lib/session";


// Who has opened a patient's summary. The patient sees every clinic that has held their summary;
// clinic operations see only their own clinic's accesses. Doctors get 403 (the clinic log is an
// operations view). Both are scoped on the server by the session user.

const consentOf = (s: Share) => (s.revokedAt ? "revoked" : isActive(s) ? "active" : "expired");

export async function GET() {
  const auth = await requireUser("patient", "clinic_ops");
  if (auth instanceof Response) return auth;
  const db = await readDb();

  const view = (s: Share) => ({
    shareId: s.id,
    patientName: s.patientName,
    clinicName: db.clinics.find((c) => c.id === s.clinicId)?.name ?? "Unknown clinic",
    consent: consentOf(s),
    sharedAt: s.sharedAt,
    expiresAt: s.expiresAt,
    revokedAt: s.revokedAt,
    entries: db.audit
      .filter((a) => a.shareId === s.id)
      .map(({ id, doctorName, action, at }) => ({ id, doctorName, action, at }))
      .sort((a, b) => b.at.localeCompare(a.at)),
  });

  const mine = auth.role === "patient" ? db.shares.filter((s) => s.patientId === auth.id) : db.shares.filter((s) => !!auth.clinicId && s.clinicId === auth.clinicId);
  return Response.json({ role: auth.role, shares: mine.map(view).sort((a, b) => b.sharedAt.localeCompare(a.sharedAt)) });
}
