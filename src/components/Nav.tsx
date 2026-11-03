"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useSession } from "@/components/Session";
import { ROLE_LABEL, homeFor, type Role } from "@/lib/roles";
import { purgeExpiredFollowUps } from "@/lib/storage";

// Links shown per role. This is a convenience: the proxy and the API routes enforce access.
const NAV: { href: string; label: string; icon: IconName; roles: Role[] }[] = [
  // Patient
  { href: "/home", label: "Home", icon: "home", roles: ["patient"] },
  { href: "/intake", label: "My check", icon: "clipboard", roles: ["patient"] },
  { href: "/appointments", label: "Appointments", icon: "calendar", roles: ["patient"] },
  { href: "/reports", label: "Reports", icon: "file", roles: ["patient"] },
  { href: "/symptoms", label: "Symptoms", icon: "alert", roles: ["patient"] },
  { href: "/labelspeak", label: "Labels", icon: "tag", roles: ["patient"] },
  { href: "/choose-clinic", label: "Clinic", icon: "clinic", roles: ["patient"] },
  { href: "/privacy", label: "Data", icon: "lock", roles: ["patient"] },
  // Doctor
  { href: "/doctor/home", label: "Home", icon: "home", roles: ["doctor"] },
  { href: "/doctor", label: "Schedule", icon: "calendar", roles: ["doctor"] },
  { href: "/requests", label: "Patient requests", icon: "stethoscope", roles: ["doctor"] },
  { href: "/doctor/followups", label: "Follow-ups", icon: "clock", roles: ["doctor"] },
  // Clinic operations
  { href: "/clinic/home", label: "Home", icon: "home", roles: ["clinic_ops"] },
  { href: "/clinic", label: "Appointments", icon: "calendar", roles: ["clinic_ops"] },
  { href: "/clinic/followups", label: "Follow-ups", icon: "clock", roles: ["clinic_ops"] },
  { href: "/clinic/dashboard", label: "Dashboard", icon: "chart", roles: ["clinic_ops"] },
  { href: "/clinic/profile", label: "Clinic profile", icon: "clinic", roles: ["clinic_ops"] },
  { href: "/clinic/audit", label: "Access log", icon: "list", roles: ["clinic_ops"] },
  { href: "/clinic/subscription", label: "Plan", icon: "card", roles: ["clinic_ops"] },
  { href: "/clinic/listing", label: "Listing", icon: "pin", roles: ["clinic_ops"] },
];

const BOTTOM_SLOTS = 4; // how many links get a slot in the phone tab bar; the rest go under "More"

/** Close a popover on Escape or a click outside it. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && close();
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open, close]);
  return ref;
}

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useSession();
  const [menu, setMenu] = useState(false);
  const links = NAV.filter((n) => user && n.roles.includes(user.role));
  const menuRef = useDismiss(menu, () => setMenu(false));

  useEffect(() => {
    purgeExpiredFollowUps();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMenu(false);
  }, [pathname]);

  const active = (href: string) => pathname === href;
  return (
    <>
      <nav className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2" aria-label="Main">
        <Link href={user ? homeFor(user.role) : "/"} className="mr-auto flex shrink-0 items-center gap-2" aria-label="CareNudge home">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent font-display text-base font-bold text-accent-ink">C</span>
          <span className="font-display text-xl font-bold tracking-tight text-ink">CareNudge</span>
        </Link>

        {/* Desktop links: icon and label. Phones use the tab bar (BottomNav) instead. */}
        <div className="hidden items-center gap-1 md:flex">
          {links.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active(n.href) ? "page" : undefined}
              className={`flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition ${active(n.href) ? "bg-accent text-accent-ink" : "text-muted hover:bg-raised hover:text-ink"}`}
            >
              <Icon name={n.icon} className="h-[18px] w-[18px]" />
              <span className="hidden lg:inline">{n.label}</span>
              <span className="sr-only lg:hidden">{n.label}</span>
            </Link>
          ))}
        </div>

        {user ? (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={menu}
              onClick={() => setMenu((v) => !v)}
              className="flex min-h-11 items-center gap-2 rounded-xl border border-line-strong bg-surface px-2 text-sm font-semibold text-ink hover:bg-raised sm:px-3"
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-play text-xs font-bold text-play-ink">{user.name.slice(0, 1).toUpperCase()}</span>
              <span className="hidden max-w-32 truncate sm:inline">{user.name}</span>
              <Icon name="chevron" className="h-4 w-4" />
            </button>
            {menu && (
              <div role="menu" className="absolute right-0 z-30 mt-2 w-72 space-y-1 rounded-2xl border border-line bg-surface p-3" style={{ boxShadow: "var(--shadow-pop)" }}>
                <p className="px-2 pb-1 text-sm text-muted">
                  <b className="text-ink">{user.name}</b> · {ROLE_LABEL[user.role]}
                </p>
                <div className="px-1 py-1">
                  <p className="px-1 pb-1 text-xs font-semibold tracking-wide text-faint uppercase">Theme</p>
                  <ThemeToggle />
                </div>
                <Link role="menuitem" href="/signup" className="flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold hover:bg-raised" title="Switch demo user">
                  <Icon name="switch" className="h-4 w-4" /> Switch demo user
                </Link>
                <button
                  role="menuitem"
                  type="button"
                  className="flex min-h-11 w-full items-center gap-2 rounded-xl px-2 text-left text-sm font-semibold hover:bg-raised"
                  onClick={async () => {
                    await signOut();
                    router.push("/");
                  }}
                >
                  <Icon name="logout" className="h-4 w-4" /> Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <ThemeToggle compact className="sm:hidden" />
            <ThemeToggle className="hidden sm:inline-flex" />
            <Link href="/signup" className="btn-primary min-h-11 py-2 text-sm">Sign in</Link>
          </>
        )}
      </nav>

    </>
  );
}

/**
 * Phone tab bar: the first links, plus "More" for the rest. It must be rendered outside <header>: the header uses
 * backdrop-blur, and a fixed element inside a blurred parent sticks to the parent instead of the bottom of the screen.
 */
export function BottomNav() {
  const pathname = usePathname();
  const { user } = useSession();
  const [more, setMore] = useState(false);
  const links = NAV.filter((n) => user && n.roles.includes(user.role));
  const moreRef = useDismiss(more, () => setMore(false));

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMore(false);
  }, [pathname]);

  const active = (href: string) => pathname === href;
  const tab = (n: (typeof NAV)[number]) => (
    <Link
      key={n.href}
      href={n.href}
      aria-current={active(n.href) ? "page" : undefined}
      className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-xs font-semibold transition ${active(n.href) ? "text-accent-text" : "text-muted"}`}
    >
      <span className={`rounded-full px-4 py-1 transition ${active(n.href) ? "bg-accent-soft" : ""}`}>
        <Icon name={n.icon} className="h-5 w-5" />
      </span>
      {n.label}
    </Link>
  );

  if (!user || links.length === 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 md:hidden" ref={moreRef}>
          {more && (
            <div role="menu" className="mx-3 mb-2 grid grid-cols-2 gap-1 rounded-2xl border border-line bg-surface p-2" style={{ boxShadow: "var(--shadow-pop)" }}>
              {links.slice(BOTTOM_SLOTS).map((n) => (
                <Link key={n.href} role="menuitem" href={n.href} className={`flex min-h-12 items-center gap-2 rounded-xl px-3 text-sm font-semibold ${active(n.href) ? "bg-accent-soft text-accent-text" : "hover:bg-raised"}`}>
                  <Icon name={n.icon} className="h-5 w-5" /> {n.label}
                </Link>
              ))}
            </div>
          )}
          <div className="flex items-stretch gap-1 border-t border-line bg-surface px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
            {(links.length > BOTTOM_SLOTS + 1 ? links.slice(0, BOTTOM_SLOTS) : links).map(tab)}
            {links.length > BOTTOM_SLOTS + 1 && (
              <button type="button" aria-expanded={more} onClick={() => setMore((v) => !v)} className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-xs font-semibold text-muted">
                <span className={`rounded-full px-4 py-1 ${more ? "bg-accent-soft text-accent-text" : ""}`}><Icon name="more" className="h-5 w-5" /></span>
                More
              </button>
            )}
          </div>
    </div>
  );
}
