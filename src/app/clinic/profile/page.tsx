"use client";

import { useEffect, useState } from "react";
import type { Clinic } from "@/lib/clinics";
import { DAY_NAMES, openStatus } from "@/lib/hours";

interface DayForm {
  open: boolean;
  p1: [string, string];
  p2: [string, string] | null; // optional second period (e.g. after a lunch break)
}

const toForm = (c: Clinic): DayForm[] =>
  DAY_NAMES.map((_, d) => {
    const ps = c.hours[d] ?? [];
    return { open: ps.length > 0, p1: ps[0] ?? ["09:00", "17:00"], p2: ps[1] ?? null };
  });

const toHours = (f: DayForm[]) => Object.fromEntries(f.map((d, i) => [i, d.open ? [d.p1, ...(d.p2 ? [d.p2] : [])] : []]));
const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

/** A doctor edits their own clinic's details. The patient clinic list and "Open now" read from this. */
export default function ClinicProfilePage() {
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [days, setDays] = useState<DayForm[]>([]);
  const [services, setServices] = useState("");
  const [languages, setLanguages] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/clinic-profile", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!d.clinic) return setMsg(d.error ?? "Couldn't load your clinic.");
        const c: Clinic = d.clinic;
        setClinic(c);
        setDays(toForm(c));
        setServices(c.services.join(", "));
        setLanguages(c.languages.join(", "));
        setAddress(c.address ?? "");
        setPhone(c.phone ?? "");
      });
  }, []);

  const setDay = (i: number, p: Partial<DayForm>) => setDays((d) => d.map((x, j) => (j === i ? { ...x, ...p } : x)));

  const save = async () => {
    const res = await fetch("/api/clinic-profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hours: toHours(days), services: list(services), languages: list(languages), address, phone }),
    });
    const data = await res.json();
    if (!res.ok) return setMsg(data.error ?? "Couldn't save.");
    setClinic(data.clinic);
    setMsg("Saved. Patients see these details in the clinic list.");
  };

  if (!clinic) return <p className="card text-muted">{msg || "Loading…"}</p>;
  const preview = openStatus({ hours: toHours(days) as Clinic["hours"] }, new Date());

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-bold text-accent-text">Clinic profile</h1>
        <p className="text-muted">{clinic.name}, {clinic.area}.{clinic.demo && " This is a fictional demo clinic."}</p>
        <p className="text-sm text-muted">Anyone signed in as operations staff at this clinic can edit it. Times are Singapore time.</p>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold text-accent-text">Opening hours</h2>
        {days.map((d, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex w-36 items-center gap-2 font-medium">
              <input type="checkbox" checked={d.open} onChange={(e) => setDay(i, { open: e.target.checked })} />
              {DAY_NAMES[i]}
            </label>
            {d.open ? (
              <>
                <input aria-label={`${DAY_NAMES[i]} opens`} type="time" className="input w-auto py-1" value={d.p1[0]} onChange={(e) => setDay(i, { p1: [e.target.value, d.p1[1]] })} />
                to
                <input aria-label={`${DAY_NAMES[i]} closes`} type="time" className="input w-auto py-1" value={d.p1[1]} onChange={(e) => setDay(i, { p1: [d.p1[0], e.target.value] })} />
                {d.p2 ? (
                  <>
                    and
                    <input aria-label={`${DAY_NAMES[i]} reopens`} type="time" className="input w-auto py-1" value={d.p2[0]} onChange={(e) => setDay(i, { p2: [e.target.value, d.p2![1]] })} />
                    to
                    <input aria-label={`${DAY_NAMES[i]} closes again`} type="time" className="input w-auto py-1" value={d.p2[1]} onChange={(e) => setDay(i, { p2: [d.p2![0], e.target.value] })} />
                    <button className="text-xs underline" onClick={() => setDay(i, { p2: null })}>Remove</button>
                  </>
                ) : (
                  <button className="text-xs text-accent-text underline" onClick={() => setDay(i, { p2: ["14:00", "18:00"] })}>Add a second period</button>
                )}
              </>
            ) : (
              <span className="text-faint">Closed</span>
            )}
          </div>
        ))}
        <p className="text-sm font-semibold">Right now, patients would see: <span className={preview.open ? "text-ok" : "text-bad"}>{preview.label}</span></p>
      </div>

      <div className="card grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="services">Services (separate with commas)</label>
          <input id="services" className="input" value={services} onChange={(e) => setServices(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="languages">Languages (separate with commas)</label>
          <input id="languages" className="input" value={languages} onChange={(e) => setLanguages(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="address">Address</label>
          <input id="address" className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Optional" />
        </div>
        <div>
          <label className="label" htmlFor="phone">Phone</label>
          <input id="phone" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
        </div>
      </div>

      {msg && <p className="text-sm text-accent-text">{msg}</p>}
      <button className="btn-primary" onClick={save}>Save clinic profile</button>
    </div>
  );
}
