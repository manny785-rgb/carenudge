"use client";

import Link from "next/link";
import { useState } from "react";
import { BookingForm } from "@/components/BookingForm";
import { NudgeCard } from "@/components/NudgeCard";
import { SYMPTOM_OPTIONS, evaluate } from "@/lib/rules/engine";
import { getCase, useHydrated, useStore } from "@/lib/storage";
import type { CareCase } from "@/lib/types";

const KEYWORDS: [RegExp, string][] = [
  [/thirst|dry mouth/, "very thirsty"],
  [/urinat|pee|toilet|bathroom/, "frequent urination"],
  [/weight|losing kilos|thinner/, "unexplained weight loss"],
  [/blur|vision|eyesight|can't see|cannot see/, "blurred vision"],
  [/heal|wound|sore|cut |ulcer/, "slow-healing wounds"],
  [/tired|fatigue|exhaust|no energy|weak/, "constant tiredness"],
];

export default function SymptomsPage() {
  return useHydrated() ? <Symptoms /> : null;
}

function Symptoms() {
  const cases = useStore()?.cases ?? [];
  const [pickedId, setSelectedCaseId] = useState<string | null>(null);
  // Fall back to the first saved check until the user picks one (the list may load after first render).
  const selectedCaseId = cases.some((c) => c.id === pickedId) ? pickedId : (cases[0]?.id ?? null);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [result, setResult] = useState<ReturnType<typeof evaluate> | null>(null);
  const [freeText, setFreeText] = useState("");
  const [notAssessed, setNotAssessed] = useState("");

  const selectedCase = selectedCaseId ? getCase(selectedCaseId) : null;

  const toggleSymptom = (x: string) => setSymptoms(symptoms.includes(x) ? symptoms.filter((s) => s !== x) : [...symptoms, x]);

  const handleCheck = () => {
    if (!selectedCase) return;
    const text = freeText.toLowerCase();
    const fromText = KEYWORDS.filter(([re]) => re.test(text)).map(([, label]) => label);
    const all = Array.from(new Set([...symptoms, ...fromText])).filter((x) => SYMPTOM_OPTIONS.includes(x));
    // Only keyword-matched symptoms feed the rules; the rest is shown as "noted, not assessed".
    setNotAssessed(freeText.trim() && fromText.length === 0 ? freeText.trim() : "");
    setResult(evaluate({ ...selectedCase.summary, symptoms: all }));
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Current symptoms check</h1>
        <p className="text-sm text-muted">
          Select a saved check, then tell us what symptoms you have right now. We&apos;ll check if any new nudges apply.
        </p>
      </div>

      <div className="card space-y-4">
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
            <div>
              <p className="label">Do you have any of these symptoms right now?</p>
              <div className="flex flex-wrap gap-2">
                {SYMPTOM_OPTIONS.map((x) => (
                  <button
                    key={x}
                    type="button"
                    onClick={() => toggleSymptom(x)}
                    className={`chip border px-3 py-1 ${symptoms.includes(x) ? "border-accent bg-accent text-accent-ink" : "border-line-strong bg-surface text-ink"}`}
                  >
                    {x}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label" htmlFor="free">Or describe how you feel in your own words</label>
              <textarea
                id="free"
                rows={3}
                className="input"
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                placeholder="e.g. I've been very tired and going to the toilet a lot at night"
              />
            </div>

            <button className="btn-primary" onClick={handleCheck} disabled={symptoms.length === 0 && !freeText.trim()}>
              Check for new nudges
            </button>

            {result && notAssessed && (
              <p className="rounded-lg bg-warn-soft border border-warn-line p-3 text-sm text-warn">
                We noted &quot;{notAssessed}&quot; but CareNudge can&apos;t assess it. If it worries you, please see a doctor.
              </p>
            )}

            {result && (
              <div className="space-y-3">
                <div className="rounded-lg border-l-4 border-l-accent bg-accent-soft p-3">
                  <p className="text-sm font-semibold text-accent-text">
                    {result.nudges.length > 0
                      ? `${result.nudges.length} nudge${result.nudges.length === 1 ? "" : "s"} apply based on your current symptoms.`
                      : "No new nudges apply with these symptoms."}
                  </p>
                </div>

                {result.nudges.length > 0 && <NudgeCard nudges={result.nudges} language={selectedCase.language} showPlain={false} />}

                {result.noNudgeNotice && (
                  <div className="rounded-lg border-l-4 border-l-line-strong bg-raised p-3">
                    <p className="text-sm text-ink">{result.noNudgeNotice}</p>
                  </div>
                )}
              </div>
            )}

            <BookingForm key={selectedCase.id} caseId={selectedCase.id} />
          </>
        ) : (
          <p className="text-sm text-muted">
            Create a check in <Link href="/intake" className="text-accent-text underline">My check</Link> first.
          </p>
        )}
      </div>
    </div>
  );
}
