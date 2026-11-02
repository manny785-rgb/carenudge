import { z } from "zod";
import { aiAvailable, structuredCall } from "@/lib/claude";
import { offlineParse } from "@/lib/offlineParser";

const Schema = z.object({
  relatives: z.array(
    z.object({
      relation: z.string(),
      degree: z.union([z.literal(1), z.literal(2)]),
      condition: z.string(),
      ageAtDiagnosis: z.number().nullable(),
    }),
  ),
  medications: z.array(
    z.object({
      name: z.string(),
      purpose: z.string().nullable(),
      forWhom: z.enum(["me", "someone_i_care_for"]),
    }),
  ),
  gestationalDiabetes: z.boolean().nullable(),
  uncertain: z.array(z.string()),
});

const SYSTEM = `You turn a person's messy, free-text description of their blood relatives' health and their medicines into structured data for a screening app in Singapore.

Rules:
- Extract only what the person actually wrote. Never guess or add conditions, ages or medicines that are not stated.
- Text may mix English, Singlish, Malay, Chinese or Tamil kinship words (e.g. "ah ma", "appa", "nenek"). Normalise relation to plain English ("father", "maternal grandmother").
- degree: 1 for parents, full siblings and children; 2 for grandparents, aunts, uncles, half-siblings, nieces, nephews. Cousins and in-laws are not blood relatives at degree 1 or 2 — leave in-laws out entirely and list cousins in "uncertain".
- Write condition in plain words. Use "type 2 diabetes" when they say diabetes/sugar/"kencing manis" without specifying type, and add a note to "uncertain" that the type was assumed.
- medications: medicines the writer takes ("me") or gives to someone they care for ("someone_i_care_for"). purpose is the stated reason, or the common use if the name is unambiguous, else null.
- gestationalDiabetes: true only if the writer says THEY had diabetes in pregnancy; null if not mentioned.
- uncertain: short notes on anything ambiguous the user should double-check. Do not diagnose or give advice.`;

export async function POST(req: Request) {
  const { text } = (await req.json()) as { text: string };
  if (!text?.trim()) return Response.json({ relatives: [], medications: [], gestationalDiabetes: null, uncertain: [], parsedBy: "offline" });

  if (aiAvailable()) {
    try {
      const out = await structuredCall({ system: SYSTEM, content: text.slice(0, 8000), schema: Schema });
      if (out) return Response.json({ ...out, parsedBy: "ai" });
    } catch (e) {
      console.error("structure: AI call failed, using offline parser", e);
    }
  }
  return Response.json({ ...offlineParse(text), gestationalDiabetes: /gestational|during (?:my )?(?:\w+ )?pregnan/i.test(text) ? true : null, parsedBy: "offline" });
}
