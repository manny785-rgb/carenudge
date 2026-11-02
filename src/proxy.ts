import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, userFromCookie } from "@/lib/authcore";
import { allowedRoles, homeFor } from "@/lib/roles";

// First layer of access control: runs before any page or API. Signed-out users are sent to
// sign-in (or get 401 for APIs), and a signed-in user on a route their role may not use is sent
// home (or gets 403 for APIs). Every API route re-checks the role itself.
export async function proxy(req: NextRequest) {
  const res = await guard(req);
  // Live data must never be served from a cache, so every API answer says so.
  if (req.nextUrl.pathname.startsWith("/api/")) res.headers.set("Cache-Control", "no-store");
  return res;
}

async function guard(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;
  const allowed = allowedRoles(pathname);
  if (!allowed) return NextResponse.next();

  const isApi = pathname.startsWith("/api/");
  const user = await userFromCookie(req.cookies.get(COOKIE)?.value);

  if (!user) {
    return isApi ? NextResponse.json({ error: "Not signed in." }, { status: 401 }) : NextResponse.redirect(new URL("/signup", req.url));
  }
  if (!allowed.includes(user.role)) {
    return isApi ? NextResponse.json({ error: "Not allowed for your role." }, { status: 403 }) : NextResponse.redirect(new URL(homeFor(user.role), req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
