// Runs every demo persona through the offline parser and the rules engine.
// Usage: npx tsx scripts/check-personas.ts
import { offlineParse } from "../src/lib/offlineParser";
import { PERSONAS } from "../src/lib/personas";
import { evaluate } from "../src/lib/rules/engine";

for (const p of PERSONAS) {
  const parsed = offlineParse(p.rawHistory);
  const result = evaluate({
    ...p.base,
    relatives: parsed.relatives,
    medications: parsed.medications,
    gestationalDiabetes: /gestational|during (?:my )?(?:\w+ )?pregnan/i.test(p.rawHistory) ? true : null,
    onDiabetesTreatment: false,
    uncertain: [],
  });
  console.log(`\n${p.displayName}`);
  console.log("  relatives:", parsed.relatives.map((r) => `${r.relation}/${r.condition}${r.ageAtDiagnosis ? "@" + r.ageAtDiagnosis : ""}`).join(", ") || "none");
  console.log("  meds:", parsed.medications.map((m) => `${m.name}(${m.forWhom})`).join(", ") || "none");
  console.log("  nudges:", result.nudges.map((n) => n.ruleId).join(", ") || `none -> ${result.noNudgeNotice?.slice(0, 60)}…`);
}
