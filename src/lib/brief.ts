import { lastTestLabel } from "./rules/engine";
import type { CareCase } from "./types";

/**
 * 3 to 5 prompts for the doctor to consider, built from fixed templates over the patient's
 * confirmed data. They are questions only: no diagnoses, no reassurance, no suggested treatment.
 */
export function buildQuestions(c: CareCase): string[] {
  const s = c.summary;
  const q: string[] = [];

  const diabetesRelatives = s.relatives.filter((r) => /diabet/i.test(r.condition));
  if (diabetesRelatives.length) {
    const list = diabetesRelatives.map((r) => `${r.relation}${r.ageAtDiagnosis ? `, diagnosed around ${r.ageAtDiagnosis}` : ""}`).join("; ");
    q.push(`The patient reports diabetes in the family (${list}). How would you like this to inform what is assessed at this visit?`);
  }

  q.push(`The patient's last diabetes test was: ${lastTestLabel(s.lastDiabetesTest)}. When would you like the next test to be done, and where?`);

  const mine = s.medications.filter((m) => m.forWhom === "me");
  q.push(
    mine.length
      ? `The patient lists these medicines: ${mine.map((m) => m.name).join(", ")}. Are they current, and is anything missing?`
      : "No medicines were listed for the patient. Is that correct?",
  );

  q.push(
    s.symptoms.length
      ? `The patient selected these symptoms: ${s.symptoms.join(", ")}. What would you like to ask about them in person?`
      : "No symptoms were selected in the app. Is there anything the patient wants to raise in person?",
  );

  if (s.gestationalDiabetes) q.push("The patient reports diabetes during a pregnancy. How would you like to follow that up?");

  const ids = c.rules?.nudges.map((n) => n.ruleId) ?? [];
  if (ids.length) q.push(`CareNudge raised ${ids.join(", ")}. Which of these will you address at this visit?`);

  return q.slice(0, 5);
}
