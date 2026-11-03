// Clinic subscription plans. A demo: the "checkout" never takes a payment and holds no card details.
// No fs or React here, so API routes and pages can both import it.
import type { Clinic } from "./clinics";

export type Plan = "free" | "pro";

export const FREE_SHARE_LIMIT = 10; // patients who can newly share with a Free clinic per calendar month
export const PRO_PRICE = "S$99 / month (demo price, nothing is charged)";

export const PLAN_FEATURES: Record<Plan, string[]> = {
  free: [`Up to ${FREE_SHARE_LIMIT} patients can newly share with you each month`, "Appointments, follow-ups and the access log", "Clinic profile and listing"],
  pro: ["Unlimited patients sharing with you", "Clinic dashboard with follow-up, no-show and teach-back numbers", "Everything in Free"],
};

/** A clinic with no plan saved (created before plans existed) is on Free. */
export const planOf = (c: Pick<Clinic, "plan">): Plan => (c.plan === "pro" ? "pro" : "free");

/** Distinct patients who shared with this clinic in the given month ("YYYY-MM", Singapore time). */
export function sharedThisMonth(shares: { clinicId: string; patientId: string; sharedAt: string }[], clinicId: string, month: string): Set<string> {
  const mine = shares.filter((s) => s.clinicId === clinicId && new Date(new Date(s.sharedAt).getTime() + 8 * 3_600_000).toISOString().slice(0, 7) === month);
  return new Set(mine.map((s) => s.patientId));
}
