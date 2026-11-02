"use client";

import Link from "next/link";
import { useState } from "react";
import { AccessLog } from "@/components/AccessLog";
import { ClinicUpdates } from "@/components/ClinicUpdates";
import { deleteCase, deleteEverything, load, useStore } from "@/lib/storage";
import { Icon } from "@/components/ui/Icon";

export default function PrivacyPage() {
  const store = useStore();
  const cases = store?.cases ?? [];
  const [msg, setMsg] = useState("");

  const download = () => {
    const blob = new Blob([JSON.stringify(load(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "carenudge-my-data.json";
    a.click();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold text-accent-text">My data</h1>
        <p className="text-muted">
          Your checks are saved to your account on the demo server, so your bookings, reports and shares stay linked. A clinic
          sees a summary only if you book there and choose to share it, and you can stop sharing at any time. Free text is sent to the AI service only to be structured or reworded.
        </p>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold text-accent-text">Who has seen my summary</h2>
        <p className="text-sm text-muted">Clinics only see your summary if you booked there and agreed. Each time a doctor opens it, it is listed here.</p>
        <AccessLog
          audience="patient"
          onRevoke={async (shareId) => {
            await fetch(`/api/shares?id=${encodeURIComponent(shareId)}`, { method: "DELETE" });
          }}
        />
      </div>

      <ClinicUpdates />

      <div className="card space-y-4">
        <h2 className="font-semibold text-accent-text">Saved checks</h2>
        {store && cases.length === 0 && <p className="text-faint">Nothing saved.</p>}
        {cases.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-3 text-sm">
            <div className="text-sm">
              <p className="font-semibold text-ink">{c.displayName}</p>
              <p className="text-xs text-faint">{new Date(c.createdAt).toLocaleDateString()} · {c.sharedAt ? "shared with doctor" : "not shared"}</p>
            </div>
            <div className="flex gap-2">
              <Link className="btn-secondary py-2 px-3 text-xs" href={`/intake?case=${c.id}`}>Open</Link>
              <button
                className="btn-danger py-2 px-3 text-xs"
                onClick={() => {
                  if (!confirm(`Delete case for ${c.displayName}? This can't be undone.`)) return;
                  deleteCase(c.id);
                  setMsg("Deleted.");
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold text-accent-text">Your data</h2>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary flex items-center gap-2" onClick={download}>
            <Icon name="download" className="h-5 w-5" /> Download (JSON)
          </button>
          <button
            className="btn-danger flex items-center gap-2"
            onClick={() => {
              if (!confirm("Delete all your saved checks from CareNudge? Any clinic you shared with will lose access. This can't be undone.")) return;
              deleteEverything();
              setMsg("All your saved checks were deleted.");
            }}
          >
            <Icon name="trash" className="h-5 w-5" /> Delete everything
          </button>
        </div>
      </div>
      {msg && <p className="text-sm text-ok font-semibold">{msg}</p>}
      <p className="text-xs text-faint">
        If you sent a share link to a doctor, their copy lives in their browser; ask them to delete it.
      </p>
    </div>
  );
}
