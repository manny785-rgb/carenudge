"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toJpegBase64 } from "@/lib/image";
import { getCase, newId, saveNow, upsertCase, useHydrated, useStore } from "@/lib/storage";
import type { Report } from "@/lib/types";
import { Icon } from "@/components/ui/Icon";

// Reports are saved to the patient's account. A clinic only ever receives the ones the patient submits.
const MAX_PDF_SIZE = 2_500_000; // base64 grows ~33%, and the browser's storage is small
const MAX_IMAGE_SIZE = 15_000_000; // photos are shrunk to a JPEG before saving

/** Read a file as base64 (no data: prefix). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** A live share of one check, as /api/shares reports it. */
interface ShareView {
  id: string;
  caseId: string;
  clinicName: string;
  sharedReportIds: string[];
}

export default function ReportsPage() {
  return useHydrated() ? <Reports /> : null;
}

function Reports() {
  const cases = useStore()?.cases ?? [];
  const [pickedId, setSelectedCaseId] = useState<string | null>(null);
  // Fall back to the first saved check until the user picks one (the list may load after first render).
  const selectedCaseId = cases.some((c) => c.id === pickedId) ? pickedId : (cases[0]?.id ?? null);
  const [clinic, setClinic] = useState("");
  const [kind, setKind] = useState<"lab" | "other">("lab");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [shares, setShares] = useState<ShareView[]>([]);

  const selectedCase = selectedCaseId ? getCase(selectedCaseId) : null;
  // Where a submitted report goes: the live share of this check.
  const share = shares.find((s) => s.caseId === selectedCaseId) ?? null;

  const loadShares = useCallback(async () => {
    const res = await fetch("/api/shares", { cache: "no-store" });
    if (res.ok) setShares((await res.json()).shares ?? []);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadShares();
  }, [loadShares]);

  const onFile = async (file: File | undefined) => {
    if (!file || !selectedCaseId) return;
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (file.size > (isPdf ? MAX_PDF_SIZE : MAX_IMAGE_SIZE)) {
      setMessage(isPdf ? "That PDF is too large. Max 2.5MB. Try a photo of the report instead." : "That image is too large.");
      return;
    }

    setUploading(true);
    setMessage("");
    try {
      const content = isPdf ? await fileToBase64(file) : await toJpegBase64(file);
      const c = getCase(selectedCaseId);
      if (c) {
        const report: Report = {
          id: newId(),
          filename: file.name,
          content,
          mimeType: isPdf ? "application/pdf" : "image/jpeg",
          kind,
          uploadedAt: new Date().toISOString(),
          clinic: clinic.trim() || undefined,
        };
        upsertCase({ ...c, reports: [...(c.reports ?? []), report] });
        setMessage(share ? `Uploaded: ${file.name}. It is not shared with ${share.clinicName} yet. Press Submit on it below if you want them to see it.` : `Uploaded: ${file.name}.`);
        setClinic("");
      }
    } catch {
      setMessage("Couldn't upload file. Try again.");
    } finally {
      setUploading(false);
    }
  };

  /** "Submit to clinic" (on) or "Withdraw" (off). The check is saved, and the server updates the clinic's copy as it does. */
  const setShared = async (reportId: string, on: boolean) => {
    if (!selectedCaseId || !share) return;
    const c = getCase(selectedCaseId);
    if (!c) return;
    const ok = await saveNow({ ...c, reports: (c.reports ?? []).map((r) => (r.id === reportId ? { ...r, shared: on } : r)) });
    setMessage(ok ? (on ? `Submitted to ${share.clinicName}. Their doctor can now see it.` : `Withdrawn. ${share.clinicName} can no longer see it.`) : "Couldn't reach your clinic. Try again.");
    await loadShares();
  };

  // Deleting a report also removes the clinic's copy: the server re-derives it when the check is saved.
  const deleteReport = async (reportId: string) => {
    if (!selectedCaseId) return;
    const c = getCase(selectedCaseId);
    if (!c) return;
    await saveNow({ ...c, reports: (c.reports ?? []).filter((r) => r.id !== reportId) });
    setMessage("Report deleted.");
    await loadShares();
  };

  const downloadReport = (report: Report) => {
    const bytes = Uint8Array.from(atob(report.content), (ch) => ch.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: report.mimeType ?? "application/octet-stream" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = report.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My reports</h1>
        <p className="text-sm text-muted">
          Upload clinic reports and test results from other clinics. They are saved to your account. Your clinic sees only the ones you submit.
        </p>
      </div>

      <div className="card space-y-3">
        <div>
          <label className="label" htmlFor="case">Select a check</label>
          <select id="case" className="input" value={selectedCaseId || ""} onChange={(e) => setSelectedCaseId(e.target.value || null)}>
            {cases.length === 0 ? (
              <option disabled>No checks saved</option>
            ) : (
              cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName} — {new Date(c.createdAt).toLocaleDateString()}
                </option>
              ))
            )}
          </select>
        </div>

        {selectedCase ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="clinic">Clinic name (optional)</label>
                <input id="clinic" type="text" className="input" placeholder="e.g. Changi General Hospital" value={clinic} onChange={(e) => setClinic(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="kind">What is it?</label>
                <select id="kind" className="input" value={kind} onChange={(e) => setKind(e.target.value as "lab" | "other")}>
                  <option value="lab">Lab report or test result</option>
                  <option value="other">Other document</option>
                </select>
              </div>
            </div>

            <label className="btn-primary cursor-pointer">
              {uploading ? "Uploading…" : <><Icon name="file" className="h-5 w-5" /> Upload report (PDF or image)</>}
              <input type="file" accept=".pdf,image/*" className="hidden" disabled={uploading} onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
            </label>

            {message && <p className={`text-sm ${message.includes("Couldn't") || message.includes("too large") ? "text-bad" : "text-accent-text"}`}>{message}</p>}

            {share ? (
              <p className="text-xs text-muted">You have shared this check with {share.clinicName}. A report stays private until you press Submit.</p>
            ) : (
              <p className="rounded-lg border border-warn-line bg-warn-soft p-3 text-sm text-warn">
                Your clinic can&apos;t see these reports yet. Reports go to a clinic only when you share this check with it: book an appointment, then choose
                &ldquo;Share with…&rdquo; in <Link href={`/intake?case=${selectedCase.id}`} className="underline">My check</Link> and tick the documents.
              </p>
            )}

            <div className="space-y-2">
              {!selectedCase.reports || selectedCase.reports.length === 0 ? (
                <p className="text-sm text-muted">No reports yet.</p>
              ) : (
                selectedCase.reports.map((r) => {
                  const withClinic = !!share && share.sharedReportIds.includes(r.id);
                  return (
                    <div key={r.id} className="space-y-2 rounded-lg border border-line p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{r.filename}</p>
                          <p className="text-xs text-muted">
                            {r.kind === "lab" ? "Lab report" : "Other document"} · {r.clinic && `${r.clinic} · `}
                            {new Date(r.uploadedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button className="btn-secondary py-1 text-sm" onClick={() => downloadReport(r)}>Download</button>
                          <button className="btn-danger py-1 text-sm" onClick={() => deleteReport(r.id)}>Delete</button>
                        </div>
                      </div>
                      {share ? (
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className={`chip ${withClinic ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"}`}>{withClinic ? `Submitted to ${share.clinicName}` : "Not submitted"}</span>
                          {withClinic ? (
                            <button className="btn-secondary py-1 text-sm" onClick={() => setShared(r.id, false)}>Withdraw</button>
                          ) : (
                            <button className="btn-primary py-1 text-sm" onClick={() => setShared(r.id, true)}>Submit to {share.clinicName}</button>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-muted">
                          Not submitted. Your clinic can see it only after you share this check with it.
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">Create a check in <Link href="/intake" className="text-accent-text underline">My check</Link> first.</p>
        )}
      </div>
    </div>
  );
}
