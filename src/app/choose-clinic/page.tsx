"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RequireRole, useSession } from "@/components/Session";
import { UrgentCare } from "@/components/UrgentCare";
import type { Clinic } from "@/lib/clinics";
import { DAY_NAMES, isOpenAt, openStatus, sgClock, useNow } from "@/lib/hours";
import { AREAS, LOCATE_MESSAGES, areaFromPostal, distanceKm, formatKm, locate, type Point } from "@/lib/geo";
import { Icon } from "@/components/ui/Icon";

export default function ClinicPage() {
  return (
    <RequireRole allow="patient">
      <ClinicPicker />
    </RequireRole>
  );
}

function ClinicPicker() {
  const router = useRouter();
  const { user, refresh } = useSession();
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  // Where the patient is. Kept in memory for this visit only: never saved, logged or sent anywhere.
  const [origin, setOrigin] = useState<{ point: Point; label: string; exact: boolean } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locNote, setLocNote] = useState("");
  const [postal, setPostal] = useState("");

  const useMyLocation = async () => {
    setLocating(true);
    setLocNote("");
    try {
      setOrigin({ point: await locate(), label: "your location", exact: true });
    } catch (e) {
      setLocNote(LOCATE_MESSAGES[(e as Error).message] ?? LOCATE_MESSAGES.unavailable);
    } finally {
      setLocating(false);
    }
  };
  const pickArea = (name: string) => {
    if (AREAS[name]) setOrigin({ point: AREAS[name], label: name, exact: false });
    setLocNote("");
  };
  const usePostal = () => {
    const area = areaFromPostal(postal);
    if (!area) return setLocNote("Please enter a 6-digit Singapore postal code.");
    pickArea(area);
  };

  const distanceOf = (c: Clinic) => (origin ? distanceKm(origin.point, c) : null);
  // Opening status uses the device clock converted to Asia/Singapore.
  const now = useNow();
  const NEARBY_KM = 15;
  const nearby = origin ? clinics.filter((c) => distanceKm(origin.point, c) <= NEARBY_KM) : clinics;
  const noneOpen = clinics.length > 0 && !nearby.some((c) => openStatus(c, now).open);
  // Filter by opening time: any time, open right now, or open on a chosen day and time.
  const [when, setWhen] = useState<"any" | "now" | "custom">("any");
  const [pickDay, setPickDay] = useState(() => sgClock(new Date()).day);
  const [pickTime, setPickTime] = useState("09:00");
  const [query, setQuery] = useState("");
  const matches = (c: Clinic) =>
    (!query.trim() || `${c.name} ${c.area}`.toLowerCase().includes(query.trim().toLowerCase())) &&
    (when === "any" ? true : when === "now" ? openStatus(c, now).open : isOpenAt(c, pickDay, pickTime));
  const sorted0 = origin ? [...clinics].sort((a, b) => distanceOf(a)! - distanceOf(b)!) : clinics;
  const sorted = sorted0.filter(matches);

  useEffect(() => {
    fetch("/api/clinics").then((r) => r.json()).then((d) => setClinics(d.clinics));
  }, []);

  const choose = async (clinicId: string) => {
    setBusy(clinicId);
    setError("");
    const res = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clinicId }) });
    if (!res.ok) {
      setBusy("");
      return setError("Couldn't save your clinic. Try again.");
    }
    await refresh();
    router.push("/home");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold text-accent-text">Choose your clinic</h1>
        <p className="text-muted">
          {"Your health summary is shared with this clinic only if you book there and agree. You can change clinic any time. Changing clinic stops the old clinic seeing your summary."}
        </p>
        <p className="text-xs text-faint">Fictional demo clinics.</p>
      </div>

      {error && <p className="rounded-lg bg-bad-soft p-3 text-bad">{error}</p>}

      <div>
        <label className="label" htmlFor="search">Search clinics by name or area</label>
        <input id="search" type="search" className="input" placeholder="e.g. Tampines" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {(
        <div className="card space-y-3">
          <h2 className="font-semibold text-accent-text">Find the nearest clinic</h2>
          <p className="text-sm text-muted">
            Tap the button to sort clinics by distance from you. Your location is used only on this page to work out distances. It is not saved or sent to CareNudge.
          </p>
          <button className="btn-secondary" onClick={useMyLocation} disabled={locating}>
            {locating ? "Finding you…" : <><Icon name="pin" className="h-5 w-5" /> Use my location</>}
          </button>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="postal">Or enter your postal code</label>
              <div className="flex gap-2">
                <input id="postal" className="input" inputMode="numeric" maxLength={6} placeholder="e.g. 520123" value={postal} onChange={(e) => setPostal(e.target.value)} />
                <button className="btn-secondary" onClick={usePostal}>Go</button>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="area">Or choose an area</label>
              <select id="area" className="input" value={origin && !origin.exact ? origin.label : ""} onChange={(e) => pickArea(e.target.value)}>
                <option value="" disabled>Choose an area…</option>
                {Object.keys(AREAS).sort().map((a) => <option key={a}>{a}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <p className="label">Show clinics that are open</p>
            <div className="flex flex-wrap gap-2">
              {([["any", "Any time"], ["now", "Open now"], ["custom", "Open at a set time"]] as const).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setWhen(v)}
                  className={`chip border px-3 py-2 ${when === v ? "border-accent bg-accent text-accent-ink" : "border-line-strong bg-surface text-ink"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {when === "custom" && (
              <div className="flex flex-wrap gap-2">
                <select aria-label="Day" className="input w-auto" value={pickDay} onChange={(e) => setPickDay(Number(e.target.value))}>
                  {DAY_NAMES.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </select>
                <input aria-label="Time (Singapore)" type="time" className="input w-auto" value={pickTime} onChange={(e) => e.target.value && setPickTime(e.target.value)} />
                <span className="self-center text-sm text-muted">Singapore time</span>
              </div>
            )}
          </div>
          {locNote && <p className="rounded-lg bg-warn-soft p-3 text-sm text-warn">{locNote}</p>}
          {origin && (
            <p className="text-sm text-ok">
              Sorted by distance from {origin.label}
              {origin.exact ? "" : " (approximate: the middle of the area)"}.
            </p>
          )}
        </div>
      )}

      {noneOpen && (
        <UrgentCare title={origin ? "Clinics near you are closed right now." : "Clinics are closed right now."} origin={origin?.point ?? null} />
      )}

      {sorted.length === 0 && clinics.length > 0 && (
        <p className="card text-muted">No clinics match{query.trim() ? ` "${query.trim()}"` : ""}{when === "now" ? " that are open right now" : when === "custom" ? ` that are open on ${DAY_NAMES[pickDay]} at ${pickTime}` : ""}. Try a different search or choose &quot;Any time&quot;.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {sorted.map((c) => {
          const status = openStatus(c, now);
          const current = user?.clinicId === c.id;
          return (
            <div key={c.id} className={`card space-y-3 ${current ? "ring-2 ring-accent" : ""}`}>
              <div>
                <h2 className="font-semibold text-accent-text">{c.name}</h2>
                <p className="text-sm text-muted">
                  {c.area}
                  {origin && <> · <b>{origin.exact ? "" : "~"}{formatKm(distanceOf(c)!)} away</b></>}
                </p>
              </div>
              <p className={`text-sm font-semibold ${status.open ? "text-ok" : "text-bad"}`}>{status.label}</p>
              {(c.address || c.phone) && <p className="text-sm">{[c.address, c.phone].filter(Boolean).join(" · ")}</p>}
              {c.demo && <p className="text-xs text-faint">Demo clinic (fictional)</p>}
              <p className="text-sm"><b>Languages:</b> {c.languages.join(", ")}</p>
              <ul className="list-disc pl-5 text-sm text-muted">
                {c.services.map((s) => <li key={s}>{s}</li>)}
              </ul>
              <button className={current ? "btn-secondary w-full" : "btn-primary w-full"} disabled={!!busy} onClick={() => choose(c.id)}>
                {current ? "Your clinic - continue" : busy === c.id ? "Saving…" : "Choose this clinic"}
              </button>
            </div>
          );
        })}
      </div>
      <p className="text-sm"><Link href="/intake" className="text-accent-text underline">Back to my check</Link></p>
    </div>
  );
}
