// Roles and the route permission table. No fs or React here, so the proxy, API routes and
// client components can all import it. The proxy (src/proxy.ts) enforces this table; every API
// route ALSO checks the role itself, so the proxy is a second layer, not the only one.

export type Role = "patient" | "doctor" | "clinic_ops";

export const ROLE_LABEL: Record<Role, string> = { patient: "patient", doctor: "doctor", clinic_ops: "clinic operations" };

/** Where each role lands after signing in, and where the logo goes (patients are sent to choose a clinic first if they have none). */
export const homeFor = (role: Role): string => (role === "doctor" ? "/doctor/home" : role === "clinic_ops" ? "/clinic/home" : "/home");

const PATIENT: Role[] = ["patient"];
const DOCTOR: Role[] = ["doctor"];
const OPS: Role[] = ["clinic_ops"];
const ANY: Role[] = ["patient", "doctor", "clinic_ops"];

/** Path prefix -> roles allowed. Anything not listed is public (home, sign-up, clinic list, AI helpers). */
const RULES: [string, Role[]][] = [
  // Patient pages
  ["/home", PATIENT], ["/intake", PATIENT], ["/appointments", PATIENT], ["/symptoms", PATIENT], ["/reports", PATIENT], ["/labelspeak", PATIENT], ["/privacy", PATIENT], ["/choose-clinic", PATIENT],
  // Doctor pages
  ["/doctor", DOCTOR], ["/requests", DOCTOR],
  // Clinic operations pages
  ["/clinic", OPS],
  // Any signed-in user
  ["/metrics", ANY],
  // APIs
  ["/api/shares", PATIENT], ["/api/cases", PATIENT], ["/api/teachback", PATIENT], ["/api/profile", PATIENT],
  ["/api/doctor-home", DOCTOR], ["/api/ops-home", OPS], ["/api/requests", DOCTOR], ["/api/results", DOCTOR], ["/api/extract-results", DOCTOR],
  ["/api/dashboard", OPS], ["/api/clinic-profile", OPS],
  ["/api/appointments", ["doctor", "clinic_ops"]], ["/api/followups", ["doctor", "clinic_ops"]], ["/api/audit", ["patient", "clinic_ops"]],
];

/** Roles allowed on a path, or null when the path is public. The longest matching prefix wins. */
export function allowedRoles(pathname: string): Role[] | null {
  let best: [string, Role[]] | null = null;
  for (const rule of RULES) {
    const [prefix] = rule;
    if ((pathname === prefix || pathname.startsWith(prefix + "/")) && (!best || prefix.length > best[0].length)) best = rule;
  }
  return best ? best[1] : null;
}
