"use client";

import { AccessLog } from "@/components/AccessLog";

/** Who at this clinic has opened which patient's summary or brief, with each patient's consent status. */
export default function AuditPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-bold text-accent-text">Access log</h1>
        <p className="text-muted">Every time a doctor at your clinic opened a patient&apos;s summary or brief. Patients can see this too.</p>
      </div>
      <AccessLog audience="clinic" />
    </div>
  );
}
