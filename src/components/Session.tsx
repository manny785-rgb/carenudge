"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import { flushSaves, setStorageUser } from "@/lib/storage";

// Demo sign-in only. The server owns the session cookie; this just mirrors "who am I" for the UI.
// Hiding things here is a convenience: the API routes enforce the real access rules.
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  clinicId: string | null;
}
export interface DemoUser {
  id: string;
  name: string;
  role: Role;
  clinicId: string | null;
}

interface Ctx {
  user: SessionUser | null;
  demoUsers: DemoUser[];
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionCtx = createContext<Ctx>({ user: null, demoUsers: [], refresh: async () => {}, signOut: async () => {} });
export const useSession = () => useContext(SessionCtx);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ user: SessionUser | null; demoUsers: DemoUser[] } | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/auth", { cache: "no-store" });
    const data = await res.json();
    setStorageUser(data.user?.role === "patient" ? data.user.id : null);
    setState({ user: data.user, demoUsers: data.demoUsers });
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    // Re-check who is signed in when the tab is shown and every 30 seconds, so an ended session shows the sign-in page
    // instead of pages that quietly load nothing.
    const check = () => document.visibilityState === "visible" && refresh();
    const tick = setInterval(check, 30_000);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(tick);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [refresh]);

  const signOut = useCallback(async () => {
    await flushSaves(); // send unsaved changes while still signed in
    await fetch("/api/auth", { method: "DELETE" });
    await refresh();
  }, [refresh]);

  // Render nothing until we know who is signed in, so pages never read the wrong user's data.
  if (!state) return null;
  return <SessionCtx.Provider value={{ ...state, refresh, signOut }}>{children}</SessionCtx.Provider>;
}

/** Wrap a page: only the allowed role sees it, everyone else gets a pointer to sign in. */
export function RequireRole({ allow, children }: { allow: Role | "any"; children: React.ReactNode }) {
  const { user } = useSession();
  if (user && (allow === "any" || user.role === allow)) return <>{children}</>;

  return (
    <div className="card mx-auto max-w-lg space-y-4 text-center">
      <h1 className="font-display text-2xl font-bold text-accent-text">
        {user ? `This area is for ${allow === "any" ? "signed-in users" : ROLE_LABEL[allow] + (allow === "clinic_ops" ? " staff" : "s")}` : "Please sign in"}
      </h1>
      <p className="text-muted">
        {user ? `You are signed in as ${user.name} (${ROLE_LABEL[user.role]}).` : "This is a demo sign-in - no real accounts."}
      </p>
      <Link href="/signup" className="btn-primary">
        {user ? "Switch demo user" : "Sign in / sign up"}
      </Link>
    </div>
  );
}
