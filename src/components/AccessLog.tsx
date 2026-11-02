"use client";

import { useCallback } from "react";
import { useLive } from "@/lib/useLive";

interface Entry {
  id: string;
  doctorName: string;
  action: "opened_summary" | "opened_brief" | "sent_reminder";
  at: string;
}
interface ShareLog {
  shareId: string;
  patientName: string;
  clinicName: string;
  consent: "active" | "revoked" | "expired";
  sharedAt: string;
  expiresAt: string;
  revokedAt: string | null;
  entries: Entry[];
}

const ACTION = { opened_summary: "opened the summary", opened_brief: "opened the pre-visit brief", sent_reminder: "sent a follow-up reminder (demo, nothing was sent)" };
const day = (iso: string) => new Date(iso).toLocaleDateString();

function consentText(s: ShareLog) {
  if (s.consent === "revoked") return `Revoked ${day(s.revokedAt!)}`;
  if (s.consent === "expired") return `Expired ${day(s.expiresAt)}`;
  return `Consent given ${day(s.sharedAt)}, access ends ${day(s.expiresAt)}`;
}

/**
 * Access log from /api/audit. As a patient: "Who has seen my summary". As clinic operations:
 * the accesses made at their own clinic. The server decides which rows are returned.
 */
export function AccessLog({ audience, onRevoke }: { audience: "patient" | "clinic"; onRevoke?: (shareId: string) => Promise<void> }) {
  // Fresh every 12 seconds and when the tab is shown (a new open or a revoke shows without a refresh).
  const fetchLog = useCallback(async () => {
    const res = await fetch("/api/audit", { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    return ((await res.json()).shares ?? []) as ShareLog[];
  }, []);
  const { data: shares, refresh: load } = useLive(fetchLog);

  if (!shares) return <p className="text-faint">Loading…</p>;
  if (!shares.length) {
    return <p className="text-sm text-muted">{audience === "patient" ? "No clinic has your summary. Nobody has seen it." : "No patient has shared with this clinic yet."}</p>;
  }

  return (
    <div className="space-y-4">
      {shares.map((s) => (
        <div key={s.shareId} className="space-y-2 rounded-lg border border-line p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">{audience === "patient" ? s.clinicName : s.patientName}</p>
            <span className={`chip ${s.consent === "active" ? "bg-ok-soft text-ok" : "bg-raised text-muted"}`}>{s.consent}</span>
          </div>
          <p className="text-sm text-muted">{consentText(s)}</p>
          {audience === "patient" && s.consent === "active" && onRevoke && (
            <button className="btn-danger py-2 text-sm" onClick={async () => { await onRevoke(s.shareId); await load(); }}>Stop sharing (revoke access)</button>
          )}
          {s.entries.length ? (
            <ul className="space-y-1 text-sm">
              {s.entries.map((e) => (
                <li key={e.id}>
                  <b>{e.doctorName}</b> {ACTION[e.action]} · {new Date(e.at).toLocaleString()}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-faint">Not opened yet.</p>
          )}
        </div>
      ))}
    </div>
  );
}
