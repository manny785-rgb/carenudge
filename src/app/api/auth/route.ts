import { z } from "zod";
import { newId, readDb, writeDb, type User } from "@/lib/db";
import { clearSession, currentUser, setSession } from "@/lib/session";

// Demo sign-in only: no passwords, no real accounts. Anyone can sign up as any role, so this is
// a demo of the access rules, not identity verification.

/** Who am I, plus the demo users for the "switch user" list. */
export async function GET() {
  const db = await readDb();
  const user = await currentUser();
  return Response.json({
    user,
    demoUsers: db.users.filter((u) => !u.id.startsWith("u-bg-")).map(({ id, name, role, clinicId }) => ({ id, name, role, clinicId })),
  });
}

const SignIn = z.union([
  z.object({ userId: z.string() }),
  z.object({
    name: z.string().trim().min(1).max(60),
    email: z.email().max(100),
    role: z.enum(["patient", "doctor", "clinic_ops"]),
    clinicId: z.string().optional(),
  }),
]);

export async function POST(req: Request) {
  const parsed = SignIn.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Please enter a name and a valid email." }, { status: 400 });

  const db = await readDb();
  const body = parsed.data;

  if ("userId" in body) {
    const u = db.users.find((x) => x.id === body.userId);
    if (!u) return Response.json({ error: "Unknown demo user." }, { status: 404 });
    await setSession(u.id);
    return Response.json({ user: u });
  }

  const email = body.email.toLowerCase();
  const staff = body.role !== "patient";
  if (staff && !db.clinics.some((c) => c.id === body.clinicId)) {
    return Response.json({ error: "Choose the clinic you belong to." }, { status: 400 });
  }

  let user = db.users.find((u) => u.email === email);
  if (user && user.role !== body.role) {
    return Response.json({ error: `That email is already registered as ${user.role === "clinic_ops" ? "clinic operations" : `a ${user.role}`}.` }, { status: 409 });
  }
  // Staff stay at the clinic they registered with.
  if (user && staff && user.clinicId !== body.clinicId) {
    return Response.json({ error: "That email is registered at a different clinic." }, { status: 409 });
  }
  if (!user) {
    user = { id: `u-${newId()}`, name: body.name, email, role: body.role, clinicId: staff ? body.clinicId! : null } satisfies User;
    db.users.push(user);
    await writeDb(db);
  }
  await setSession(user.id);
  return Response.json({ user });
}

export async function DELETE() {
  await clearSession();
  return Response.json({ ok: true });
}
