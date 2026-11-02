export type LastTest = "within_1y" | "1_3y" | "over_3y" | "never" | "unknown";

export interface Relative {
  relation: string; // e.g. "father", "maternal aunt"
  degree: 1 | 2; // 1 = parent/sibling/child, 2 = grandparent/aunt/uncle/half-sibling
  condition: string; // e.g. "type 2 diabetes"
  ageAtDiagnosis: number | null;
}

export interface Medication {
  name: string;
  purpose: string | null;
  forWhom: "me" | "someone_i_care_for";
}

export interface HealthSummary {
  age: number | null;
  sex: "female" | "male" | "other" | null;
  heightCm: number | null;
  weightKg: number | null;
  lastDiabetesTest: LastTest;
  gestationalDiabetes: boolean | null;
  symptoms: string[];
  relatives: Relative[];
  medications: Medication[];
  onDiabetesTreatment: boolean;
  /** Things the AI was unsure about and the user should double-check. */
  uncertain: string[];
}

export type NudgePriority = "see_doctor_soon" | "due" | "ask_doctor";

export interface Nudge {
  ruleId: string;
  priority: NudgePriority;
  title: string;
  reason: string;
  action: string;
  /** Short answer used in the teach-back check. */
  whyShort: string;
  actionShort: string;
  source: { name: string; url: string; quote: string };
  /** Optional plain-language / translated rewrite from the LLM. */
  plain?: { headline: string; why: string; whatToDo: string; language: string };
}

export interface RulesResult {
  nudges: Nudge[];
  /** Always shown when no nudge fires. Never an all-clear. */
  noNudgeNotice: string | null;
  suppressedBecauseTreated: boolean;
  checkedAt: string;
}

export type FollowUpStatus = "planned" | "booked" | "done" | "missed";

export interface FollowUp {
  id: string;
  test: string;
  dueDate: string; // yyyy-mm-dd
  status: FollowUpStatus;
  where: string;
  result: string;
  createdBy: "patient" | "doctor";
  /** Optional appointment time (HH:MM, Singapore time) for visits the patient booked. */
  time?: string;
  /** Set when the doctor marks it done. */
  doneDate?: string;
  /** Simulated reminders (demo): ISO timestamps. No real SMS or email is sent. */
  reminders?: string[];
}

/** A lab value. Only doctor-confirmed values are treated as clinic records. */
export interface TestResult {
  id: string;
  test: string;
  value: number;
  unit: string;
  date: string; // yyyy-mm-dd
  /** The reference range printed on the report, if any. Never computed by CareNudge. */
  rangeLow: number | null;
  rangeHigh: number | null;
  source: "doctor-confirmed" | "patient-reported";
  /** The shared report this value was read from, if any. */
  reportId?: string;
}

export interface DoctorFindings {
  bpSys: string;
  bpDia: string;
  bmi: string;
  hba1c: string;
  fastingGlucose: string;
  notes: string;
  reviewedAt: string | null;
}

export interface Report {
  id: string;
  filename: string;
  content: string; // base64-encoded file content
  uploadedAt: string;
  clinic?: string;
  /** Allowed: PDF or JPEG/PNG/WebP. Decides how the doctor's viewer shows it. */
  mimeType?: string;
  /** "lab" is offered for sharing by default; "other" is not. */
  kind?: "lab" | "other";
  /** The patient's choice to share this document with their clinic. Unset = not decided yet (nothing is shared). */
  shared?: boolean;
}

/** Is this report ticked in the "Choose what to share" list? Lab reports start ticked, everything else unticked. */
export const reportShareDefault = (r: Report): boolean => r.shared ?? r.kind === "lab";

export interface CareCase {
  id: string;
  displayName: string;
  createdAt: string;
  consentAt: string;
  rawHistory: string;
  parsedBy: "ai" | "offline";
  confirmedAt: string | null;
  summary: HealthSummary;
  rules: RulesResult | null;
  language: string;
  sharedAt: string | null;
  findings: DoctorFindings;
  followUps: FollowUp[];
  reports?: Report[];
  results?: TestResult[];
}

export interface TeachBackRecord {
  caseId: string;
  ruleId: string;
  whyCorrect: boolean;
  actionCorrect: boolean;
  at: string;
}

export interface PrepRecord {
  caseId: string;
  seconds: number;
  at: string;
}

