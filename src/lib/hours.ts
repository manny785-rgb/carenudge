import { useEffect, useState } from "react";
import type { Clinic } from "./clinics";
import { sgClock } from "./sgtime";

export { sgClock };

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const DAY_NAMES = DAYS;

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
function fmt(hhmm: string) {
  const m = toMin(hhmm);
  const h = Math.floor(m / 60);
  return `${h % 12 || 12}:${String(m % 60).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

/** Is the clinic open on this weekday (0 = Sunday) at this time ("HH:MM")? */
export function isOpenAt(c: Pick<Clinic, "hours">, day: number, hhmm: string): boolean {
  const m = toMin(hhmm);
  return (c.hours[day] ?? []).some(([o, cl]) => m >= toMin(o) && m < toMin(cl));
}

export interface OpenStatus {
  open: boolean;
  label: string;
}

/** "Open now · closes 9:00 pm" or "Closed, opens tomorrow at 9:00 am". */
export function openStatus(c: Pick<Clinic, "hours">, now: Date): OpenStatus {
  const { day, minutes } = sgClock(now);
  const today = c.hours[day] ?? [];
  const current = today.find(([o, cl]) => minutes >= toMin(o) && minutes < toMin(cl));
  if (current) return { open: true, label: `Open now · closes ${fmt(current[1])}` };

  const later = today.find(([o]) => toMin(o) > minutes);
  if (later) return { open: false, label: `Closed, opens at ${fmt(later[0])}` };

  for (let i = 1; i <= 7; i++) {
    const d = (day + i) % 7;
    const first = c.hours[d]?.[0];
    if (first) return { open: false, label: `Closed, opens ${i === 1 ? "tomorrow" : DAYS[d]} at ${fmt(first[0])}` };
  }
  return { open: false, label: "Closed" };
}

/** Re-reads the device clock every minute so "Open now" stays accurate. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}
