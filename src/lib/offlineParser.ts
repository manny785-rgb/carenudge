import type { Medication, Relative } from "./types";

// Fallback used only when the LLM is unavailable. Deliberately simple; the confirm
// screen tells the user to check every row.

const RELATIONS: [RegExp, string, 1 | 2][] = [
  [/\b(grand(?:father|pa|dad)|ah ?gong)\b/i, "grandfather", 2],
  [/\b(grand(?:mother|ma|mum|mom)|ah ?ma|nenek)\b/i, "grandmother", 2],
  [/\b(aunt|auntie|aunty)\b/i, "aunt", 2],
  [/\buncle\b/i, "uncle", 2],
  [/\b(father|dad|daddy|papa|appa)\b/i, "father", 1],
  [/\b(mother|mum|mom|mummy|mama|amma)\b/i, "mother", 1],
  [/\b(brother|bro)\b/i, "brother", 1],
  [/\b(sister|sis)\b/i, "sister", 1],
  [/\bson\b/i, "son", 1],
  [/\bdaughter\b/i, "daughter", 1],
];

const CONDITIONS: [RegExp, string][] = [
  [/type ?1/i, "type 1 diabetes"],
  [/diabet|sugar|kencing manis|\bdm\b|t2dm/i, "type 2 diabetes"],
  [/high blood pressure|hypertension|\bbp\b/i, "high blood pressure"],
  [/cholesterol|lipid/i, "high cholesterol"],
  [/heart attack|heart disease|cardiac|bypass/i, "heart disease"],
  [/stroke/i, "stroke"],
  [/kidney/i, "kidney disease"],
  [/cancer/i, "cancer"],
];

const MEDS: [RegExp, string, string][] = [
  [/metformin|glucophage/i, "metformin", "diabetes"],
  [/insulin/i, "insulin", "diabetes"],
  [/gliclazide|diamicron/i, "gliclazide", "diabetes"],
  [/sitagliptin|januvia/i, "sitagliptin", "diabetes"],
  [/empagliflozin|jardiance/i, "empagliflozin", "diabetes"],
  [/amlodipine|norvasc/i, "amlodipine", "blood pressure"],
  [/losartan/i, "losartan", "blood pressure"],
  [/atorvastatin|lipitor/i, "atorvastatin", "cholesterol"],
  [/simvastatin/i, "simvastatin", "cholesterol"],
  [/aspirin/i, "aspirin", "heart / blood thinning"],
  [/paracetamol|panadol/i, "paracetamol", "pain / fever"],
];

// A medicine counts as the writer's own only when the sentence is about them and no relative.
const FIRST_PERSON = /\b(i(?:'m| am)? (?:take|takes|taking|on)|i'm on|my (?:own )?(?:medicine|meds|pills?))\b/i;
const GIVES_TO_OTHER = /\b(give|gives|giving) (?:her|him|them|my)\b/i;

export function offlineParse(text: string): { relatives: Relative[]; medications: Medication[]; uncertain: string[] } {
  const sentences = text.split(/[.\n;]+/).map((s) => s.trim()).filter(Boolean);
  const relatives: Relative[] = [];
  const medications: Medication[] = [];

  for (const sentence of sentences) {
    // "uncle on mum side" / "dad's side" describe lineage, not another relative.
    const s = sentence.replace(/\(?\b(?:on )?(?:mum|mom|mother|dad|father)(?:'s)? side\)?/gi, "");
    const age = s.match(/\b(?:at|age|aged|when (?:he|she) was)\s*(?:around |about |roughly )?(\d{2})\b/i);
    const rels = RELATIONS.filter(([re]) => re.test(s));
    let conds = CONDITIONS.filter(([re]) => re.test(s));
    if (conds.some(([, c]) => c === "type 1 diabetes")) conds = conds.filter(([, c]) => c !== "type 2 diabetes");
    const takesMed = MEDS.some(([re]) => re.test(s));
    // Skip relation matches in sentences that are only about someone's medicine.
    if (!(takesMed && conds.length === 0)) {
      for (const [, relation, degree] of rels.slice(0, 2)) {
        for (const [, condition] of conds) {
          if (!relatives.some((r) => r.relation === relation && r.condition === condition)) {
            relatives.push({ relation, degree, condition, ageAtDiagnosis: age ? Number(age[1]) : null });
          }
        }
      }
    }
    for (const [re, name, purpose] of MEDS) {
      if (re.test(s) && !medications.some((m) => m.name === name)) {
        const mine = FIRST_PERSON.test(s) && rels.length === 0 && !GIVES_TO_OTHER.test(s);
        medications.push({ name, purpose, forWhom: mine ? "me" : "someone_i_care_for" });
      }
    }
  }

  return {
    relatives,
    medications,
    uncertain: ["AI was unavailable, so a basic keyword parser was used. Please check every row carefully."],
  };
}
