import type { HealthSummary } from "./types";

// Fictional demo personas for live demos and the 3–5 person teach-back test.
export interface Persona {
  key: string;
  displayName: string;
  blurb: string;
  base: Pick<HealthSummary, "age" | "sex" | "heightCm" | "weightKg" | "lastDiabetesTest" | "symptoms">;
  rawHistory: string;
}

export const PERSONAS: Persona[] = [
  {
    key: "meiling",
    displayName: "Mei Ling, 46",
    blurb: "Office manager. Dad has diabetes. Last blood test ~5 years ago.",
    base: { age: 46, sex: "female", heightCm: 158, weightKg: 60, lastDiabetesTest: "over_3y", symptoms: [] },
    rawHistory:
      "my dad got sugar problem when he was around 52, now on metformin. mum has high blood pressure, takes amlodipine i think. ah ma (dad's side) also had diabetes. i don't take any medicine.",
  },
  {
    key: "arjun",
    displayName: "Arjun, 34",
    blurb: "Software engineer. Mum and brother diabetic. Never tested.",
    base: { age: 34, sex: "male", heightCm: 172, weightKg: 78, lastDiabetesTest: "never", symptoms: [] },
    rawHistory:
      "Amma was diagnosed with type 2 diabetes at 45. My elder brother found out last year at 38. Appa had a heart attack at 60. Uncle on mum side has high cholesterol. I'm not on any meds.",
  },
  {
    key: "siti",
    displayName: "Siti, 52 (caregiver)",
    blurb: "Cares for her mother. Had gestational diabetes.",
    base: { age: 52, sex: "female", heightCm: 155, weightKg: 64, lastDiabetesTest: "unknown", symptoms: [] },
    rawHistory:
      "I had diabetes during my second pregnancy. My mother (78) has kencing manis and high blood pressure, I give her metformin and losartan every morning. Sister ok as far as I know. I take panadol sometimes.",
  },
  {
    key: "daniel",
    displayName: "Daniel, 29",
    blurb: "No family history he knows of. Shows the 'no all-clear' notice.",
    base: { age: 29, sex: "male", heightCm: 178, weightKg: 70, lastDiabetesTest: "never", symptoms: [] },
    rawHistory: "Not that I know of. Parents are healthy I think. No medicines.",
  },
];
