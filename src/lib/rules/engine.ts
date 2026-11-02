import rulesFile from "./diabetes.json";
import type { HealthSummary, LastTest, Nudge, NudgePriority, RulesResult } from "../types";

interface RuleWhen {
  symptomsAny?: string[];
  ageMin?: number;
  ageMax?: number;
  lastTestIn?: LastTest[];
  firstDegreeRelativeWith?: string;
  bmiMin?: number;
  gestationalDiabetes?: boolean;
}

interface Rule extends Omit<Nudge, "plain" | "ruleId"> {
  id: string;
  when: RuleWhen;
}

const RULES = rulesFile.rules as unknown as Rule[];

export const SYMPTOM_OPTIONS = (RULES.find((r) => r.id === "DM-SYMPTOMS")?.when.symptomsAny ?? []) as string[];

const LAST_TEST_LABEL: Record<LastTest, string> = {
  within_1y: "within the last year",
  "1_3y": "1–3 years ago",
  over_3y: "more than 3 years ago",
  never: "never",
  unknown: "not known",
};

export function lastTestLabel(t: LastTest) {
  return LAST_TEST_LABEL[t];
}

export function bmiOf(s: HealthSummary): number | null {
  if (!s.heightCm || !s.weightKg) return null;
  const m = s.heightCm / 100;
  return Math.round((s.weightKg / (m * m)) * 10) / 10;
}

const isDiabetes = (condition: string) => {
  const c = condition.toLowerCase();
  return (c.includes("diabet") || c.includes("sugar")) && !c.includes("type 1") && !c.includes("gestational");
};

function matches(when: RuleWhen, s: HealthSummary): boolean {
  if (when.symptomsAny && !s.symptoms.some((x) => when.symptomsAny!.includes(x))) return false;
  if (when.ageMin !== undefined && (s.age === null || s.age < when.ageMin)) return false;
  if (when.ageMax !== undefined && (s.age === null || s.age > when.ageMax)) return false;
  if (when.lastTestIn && !when.lastTestIn.includes(s.lastDiabetesTest)) return false;
  if (when.firstDegreeRelativeWith && !s.relatives.some((r) => r.degree === 1 && isDiabetes(r.condition))) return false;
  if (when.bmiMin !== undefined) {
    const bmi = bmiOf(s);
    if (bmi === null || bmi < when.bmiMin) return false;
  }
  if (when.gestationalDiabetes !== undefined && s.gestationalDiabetes !== when.gestationalDiabetes) return false;
  return true;
}

function fill(template: string, s: HealthSummary): string {
  const fdr = s.relatives.filter((r) => r.degree === 1 && isDiabetes(r.condition)).map((r) => r.relation);
  return template
    .replace("{age}", String(s.age ?? "?"))
    .replace("{lastTest}", LAST_TEST_LABEL[s.lastDiabetesTest])
    .replace("{bmi}", String(bmiOf(s) ?? "?"))
    .replace("{symptoms}", s.symptoms.join(", "))
    .replace("{relativeList}", fdr.join(" and ") || "close relative");
}

const ORDER: NudgePriority[] = ["see_doctor_soon", "due", "ask_doctor"];

/** Deterministic: same summary in, same nudges out. No AI involved. */
export function evaluate(s: HealthSummary): RulesResult {
  const checkedAt = new Date().toISOString();
  const symptomRule = RULES.find((r) => r.id === "DM-SYMPTOMS")!;

  if (s.onDiabetesTreatment) {
    // Symptoms still get flagged even if treated; screening nudges are suppressed.
    const nudges = matches(symptomRule.when, s) ? [toNudge(symptomRule, s)] : [];
    return { nudges, noNudgeNotice: rulesFile.treatedNotice, suppressedBecauseTreated: true, checkedAt };
  }

  const fired = RULES.filter((r) => matches(r.when, s)).map((r) => toNudge(r, s));
  // DM-FDR-YOUNG and DM-BMI-YOUNG share an action; keep both reasons but they are distinct rules.
  fired.sort((a, b) => ORDER.indexOf(a.priority) - ORDER.indexOf(b.priority));
  return {
    nudges: fired,
    noNudgeNotice: fired.length ? null : rulesFile.noNudgeNotice,
    suppressedBecauseTreated: false,
    checkedAt,
  };
}

function toNudge(r: Rule, s: HealthSummary): Nudge {
  return {
    ruleId: r.id,
    priority: r.priority,
    title: r.title,
    reason: fill(r.reason, s),
    action: r.action,
    whyShort: r.whyShort,
    actionShort: r.actionShort,
    source: r.source,
  };
}

/** Distractors for the teach-back check, drawn from other rules plus common misconceptions. */
export function teachBackOptions(n: Nudge) {
  const misconceptions = {
    why: ["The AI has diagnosed me with diabetes", "It's a random reminder sent to everyone"],
    action: ["Nothing — the app says I'm fine", "Start diabetes medicine on my own"],
  };
  const otherWhy = RULES.filter((r) => r.whyShort !== n.whyShort).map((r) => r.whyShort);
  const otherAction = RULES.filter((r) => r.actionShort !== n.actionShort).map((r) => r.actionShort);
  const why = shuffle([n.whyShort, misconceptions.why[0], misconceptions.why[1], otherWhy[0]]);
  const action = shuffle([n.actionShort, misconceptions.action[0], misconceptions.action[1], otherAction[0]]);
  return { why, action };
}

function shuffle<T>(xs: T[]): T[] {
  const a = [...new Set(xs)];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const RULESET_VERSION = rulesFile.version;
