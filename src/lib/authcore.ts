// Cookie signing and verification with no next/headers dependency, so the proxy and the
// API helpers share one implementation. Demo sign-in only: the cookie holds just a user id.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { User } from "./db";
import { getAuthData } from "./dbstore";

export const COOKIE = "cn_session";

const sign = (id: string, secret: string) => createHmac("sha256", secret).update(id).digest("hex");

export async function cookieValueFor(userId: string): Promise<string> {
  const { secret } = await getAuthData(userId);
  return `${userId}.${sign(userId, secret ?? "")}`;
}

/**
 * The user behind a session cookie, or null. The signature is checked, and the role and clinic
 * are read fresh from the database, never from the cookie.
 */
export async function userFromCookie(raw: string | undefined): Promise<User | null> {
  if (!raw) return null;
  const [id, sig] = raw.split(".");
  const { secret, user } = await getAuthData(id ?? "");
  if (!secret || !user) return null;
  const expected = sign(id, secret);
  if (!sig || sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return user;
}
