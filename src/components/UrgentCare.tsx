"use client";

import { Icon } from "@/components/ui/Icon";
import { EMERGENCY_DEPTS } from "@/lib/emergency";
import { distanceKm, formatKm, type Point } from "@/lib/geo";

/** Fixed wording. CareNudge never judges whether a symptom is serious or can wait. */
export const URGENT_BANNER =
  "CareNudge does not assess symptoms. If you feel unwell or have chest pain, trouble breathing, or any sudden or severe symptom, call 995 or go to A&E now.";

/** Where to get urgent care when clinics are closed: 24-hour emergency departments, nearest first. */
export function UrgentCare({ title, origin }: { title: string; origin: Point | null }) {
  const depts = origin
    ? [...EMERGENCY_DEPTS].map((d) => ({ d, km: distanceKm(origin, d) })).sort((a, b) => a.km - b.km)
    : EMERGENCY_DEPTS.map((d) => ({ d, km: null as number | null }));

  return (
    <section className="card space-y-3 border-l-4 border-l-play">
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="urgent flex items-start gap-2"><Icon name="siren" className="mt-0.5 h-5 w-5" /><span>{URGENT_BANNER}</span></p>
      <p className="text-sm text-muted">Emergency departments open 24 hours{origin ? ", nearest first" : ""}:</p>
      <ul className="space-y-2 text-sm">
        {depts.map(({ d, km }) => (
          <li key={d.id} className="rounded-lg bg-raised px-3 py-2">
            <p className="font-semibold">
              {d.name}
              {km !== null && <span className="font-normal text-muted"> · {formatKm(km)} away</span>}
            </p>
            <p className="text-muted">{d.address}{d.note ? ` · ${d.note}` : ""}</p>
            {d.phone && <p>Hospital line: <a className="text-accent-text underline" href={`tel:${d.phone.replace(/\s/g, "")}`}>{d.phone}</a></p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
