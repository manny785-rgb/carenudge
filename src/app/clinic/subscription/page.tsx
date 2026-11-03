"use client";

import { useCallback, useState } from "react";
import { LiveStamp } from "@/components/LiveStamp";
import { Icon } from "@/components/ui/Icon";
import { Tick } from "@/components/ui/Tick";
import { PLAN_FEATURES, PRO_PRICE, type Plan } from "@/lib/plans";
import { useLive } from "@/lib/useLive";

interface Sub {
  plan: Plan;
  planSince: string | null;
  usage: { month: string; sharedPatients: number; limit: number | null };
}

/** Clinic operations manage their clinic's plan. Demo only: no payment is taken and no card details are asked for. */
export default function SubscriptionPage() {
  const fetchSub = useCallback(async () => {
    const res = await fetch("/api/subscription", { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as Sub;
  }, []);
  const { data, at, refresh } = useLive(fetchSub);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  if (!data) return <p className="text-faint">Loading…</p>;

  const change = async (plan: Plan) => {
    setBusy(true);
    setError("");
    const res = await fetch("/api/subscription", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return setError("Couldn't change the plan. Try again.");
    setConfirming(false);
    refresh();
  };

  const { usage } = data;
  const pro = data.plan === "pro";
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold text-accent-text">Plan and subscription</h1>
        <p className="rounded-lg border border-warn-line bg-warn-soft px-3 py-2 text-sm font-semibold text-warn">Demo only: no payment is taken and no card details are asked for.</p>
        <p className="text-sm text-muted">Your clinic is on the <b>{pro ? "Pro" : "Free"}</b> plan{data.planSince && <> since {new Date(data.planSince).toLocaleDateString("en-SG")}</>}. <LiveStamp at={at} /></p>
      </div>

      {error && <p className="rounded-lg bg-bad-soft p-3 text-sm text-bad">{error}</p>}

      <section className="card space-y-2">
        <h2 className="font-bold">Usage this month</h2>
        <p className="font-display text-4xl font-bold text-accent-text">
          {usage.sharedPatients}{usage.limit !== null && <span className="text-xl text-muted"> / {usage.limit}</span>}
        </p>
        <p className="text-sm text-muted">
          {usage.limit === null ? "patients shared with you. No limit on Pro." : "patients have shared with you. At the limit, new patients can't share until next month or until you upgrade."}
        </p>
        {usage.limit !== null && (
          <div className="h-2 overflow-hidden rounded-full bg-raised" role="progressbar" aria-valuemin={0} aria-valuemax={usage.limit} aria-valuenow={Math.min(usage.sharedPatients, usage.limit)} aria-label="Patients shared this month">
            <div className={`h-full ${usage.sharedPatients >= usage.limit ? "bg-bad" : "bg-accent"}`} style={{ width: `${Math.min(100, (usage.sharedPatients / usage.limit) * 100)}%` }} />
          </div>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {(["free", "pro"] as Plan[]).map((p) => (
          <section key={p} className={`card space-y-3 ${data.plan === p ? "border-accent" : ""}`}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-xl font-bold">{p === "pro" ? "Pro" : "Free"}</h2>
              {data.plan === p && <span className="chip tone-accent">Current plan</span>}
            </div>
            <p className="text-sm text-muted">{p === "pro" ? PRO_PRICE : "S$0"}</p>
            <ul className="space-y-1 text-sm">
              {PLAN_FEATURES[p].map((f) => (
                <li key={f} className="flex gap-2"><Tick className="mt-0.5 h-4 w-4 shrink-0 text-ok" /> {f}</li>
              ))}
            </ul>
            {p === "pro" && !pro && !confirming && <button className="btn-primary w-full" onClick={() => setConfirming(true)}>Upgrade to Pro</button>}
            {p === "pro" && !pro && confirming && (
              <div className="space-y-2 rounded-lg bg-accent-soft p-3 text-sm">
                <p className="font-semibold text-accent-text">Confirm the demo upgrade</p>
                <p>This switches your clinic to Pro. Nothing is charged.</p>
                <div className="flex gap-2">
                  <button className="btn-primary" disabled={busy} onClick={() => change("pro")}>{busy ? "Upgrading…" : "Confirm upgrade"}</button>
                  <button className="btn-secondary" disabled={busy} onClick={() => setConfirming(false)}>Cancel</button>
                </div>
              </div>
            )}
            {p === "free" && pro && <button className="btn-secondary w-full" disabled={busy} onClick={() => change("free")}>Downgrade to Free</button>}
          </section>
        ))}
      </div>

      {!pro && (
        <p className="flex items-center gap-2 text-sm text-muted"><Icon name="lock" className="h-4 w-4" /> The clinic dashboard is locked on the Free plan.</p>
      )}
    </div>
  );
}
