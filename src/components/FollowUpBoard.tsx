"use client";

import { useCallback, useState } from "react";
import { LiveStamp } from "@/components/LiveStamp";
import { useLive } from "@/lib/useLive";

type Bucket = "overdue" | "due_week" | "upcoming" | "done";
interface Item {
  shareId: string;
  followUpId: string;
  patientName: string;
  test: string;
  dueDate: string;
  status: string;
  doneDate: string | null;
  reminders: string[];
  bucket: Bucket;
}

const TABS: { key: Bucket; label: string; chip: string }[] = [
  { key: "overdue", label: "Overdue", chip: "bg-bad-soft text-bad" },
  { key: "due_week", label: "Due this week", chip: "bg-warn-soft text-warn" },
  { key: "upcoming", label: "Upcoming", chip: "bg-info-soft text-info" },
  { key: "done", label: "Done", chip: "bg-ok-soft text-ok" },
];

/**
 * Follow-up board for the signed-in staff member's own clinic; the server decides what is overdue
 * (Singapore time). Doctors see the clinical follow-up and can mark it done. Operations see only a
 * generic "Follow-up" label (the server removes the test name) and can reschedule or remind.
 */
export function FollowUpBoard({ mode }: { mode: "doctor" | "ops" }) {
  const [tab, setTab] = useState<Bucket>("overdue");
  const [dates, setDates] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");

  // Fresh every 12 seconds and when the tab is shown, so patient bookings and changes appear without a refresh.
  const fetchBoard = useCallback(async () => {
    const res = await fetch("/api/followups", { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    return { items: (data.items ?? []) as Item[], today: data.today as string };
  }, []);
  const { data: board, at, refresh: load } = useLive(fetchBoard);
  const items = board?.items ?? null;
  const today = board?.today ?? "";

  const act = async (i: Item, action: "done" | "reschedule" | "reminder") => {
    const date = dates[i.followUpId] || today;
    const res = await fetch("/api/followups", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shareId: i.shareId, followUpId: i.followUpId, action, date: action === "reminder" ? undefined : date }),
    });
    setNote(res.ok ? (action === "reminder" ? `Reminder recorded for ${i.patientName} (demo, nothing was sent).` : "Saved.") : "Couldn't save. This request may have been revoked.");
    await load();
  };

  if (!items) return <p className="text-faint">Loading…</p>;
  const shown = items.filter((i) => i.bucket === tab);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-bold text-accent-text">{mode === "doctor" ? "Follow-ups and care plan" : "Follow-up logistics"}</h1>
        <p className="text-muted">
          {mode === "doctor" ? "Clinical follow-ups for your clinic's patients." : "Follow-up logistics for your clinic. Clinical details are not shown."} Today is {today} (Singapore). Reminders are simulated: nothing is sent. <LiveStamp at={at} />
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`chip border px-3 py-2 ${tab === t.key ? "border-accent bg-accent text-accent-ink" : "border-line-strong bg-surface text-ink"}`}
          >
            {t.label} ({items.filter((i) => i.bucket === t.key).length})
          </button>
        ))}
      </div>
      {note && <p className="text-sm text-accent-text">{note}</p>}

      {shown.length === 0 ? (
        <p className="card text-muted">Nothing here.</p>
      ) : (
        <div className="space-y-3">
          {shown.map((i) => (
            <div key={i.followUpId} className="card space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{i.patientName} · {i.test}</p>
                  <p className="text-sm text-muted">
                    Due {i.dueDate}
                    {i.doneDate && ` · done ${i.doneDate}`}
                  </p>
                </div>
                <span className={`chip ${TABS.find((t) => t.key === i.bucket)!.chip}`}>{i.status}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  aria-label="Date"
                  type="date"
                  className="input w-auto py-1"
                  value={dates[i.followUpId] ?? today}
                  onChange={(e) => setDates({ ...dates, [i.followUpId]: e.target.value })}
                />
                {mode === "doctor" && i.status !== "done" && <button className="btn-primary py-2 text-sm" onClick={() => act(i, "done")}>Mark done on date</button>}
                <button className="btn-secondary py-2 text-sm" onClick={() => act(i, "reschedule")}>Reschedule to date</button>
                {i.status !== "done" && <button className="btn-secondary py-2 text-sm" onClick={() => act(i, "reminder")}>Send reminder to patient (demo)</button>}
              </div>
              {i.reminders.length > 0 && (
                <p className="text-xs text-muted">Reminder sent (demo) {new Date(i.reminders[i.reminders.length - 1]).toLocaleString()}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
