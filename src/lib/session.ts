// Demo sign-in: a signed httpOnly cookie holding the user id. No passwords, no real accounts.
import { cookies } from "next/headers";
import { COOKIE, cookieValueFor, userFromCookie } from "./authcore";
import type { User } from "./db";
import type { Role } from "./roles";

export async function setSession(userId: string) {
  (await cookies()).set(COOKIE, await cookieValueFor(userId), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

/** The signed-in user, or null. */
export async function currentUser(): Promise<User | null> {
  return await userFromCookie((await cookies()).get(COOKIE)?.value);
}

/**
 * Use at the top of every API route:
 *   const a = await requireUser("doctor"); if (a instanceof Response) return a;
 * 401 when signed out, 403 when the role isn't one of the allowed ones.
 */
export async function requireUser(...roles: Role[]): Promise<User | Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Not signed in." }, { status: 401 });
  if (roles.length && !roles.includes(user.role)) return Response.json({ error: "Not allowed for your role." }, { status: 403 });
  return user;
}

/** Like requireUser, for clinic staff: also guarantees a clinic, so queries can be scoped to it. */
export async function requireStaff(...roles: Role[]): Promise<(User & { clinicId: string }) | Response> {
  const user = await requireUser(...roles);
  if (user instanceof Response) return user;
  if (!user.clinicId) return Response.json({ error: "No clinic on this account." }, { status: 403 });
  return user as User & { clinicId: string };
}
