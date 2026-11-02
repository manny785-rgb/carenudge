import { z } from "zod";
import { aiAvailable, structuredCall } from "@/lib/claude";
import type { Nudge } from "@/lib/types";

const Schema = z.object({
  items: z.array(
    z.object({
      ruleId: z.string(),
      headline: z.string(),
      why: z.string(),
      whatToDo: z.string(),
    }),
  ),
});

const SYSTEM = `You rewrite health screening nudges so a busy adult or an older person understands them at a glance.

The nudges were decided by a fixed rules engine. You only rewrite wording. Hard rules:
- Keep exactly the same meaning, recommendation and urgency. Do not add, remove or soften any advice.
- Do not diagnose, do not mention probabilities or statistics, and never say the person is fine or healthy.
- Do not add new medical facts beyond what is in the nudge.
- Plain words, about a primary-school reading level. headline ≤ 10 words, why ≤ 30 words, whatToDo ≤ 25 words.
- Write in the requested language. For Chinese use Simplified Chinese; for Malay use Bahasa Melayu; for Tamil use Tamil script.
- Return one item per input nudge with the same ruleId.`;

export async function POST(req: Request) {
  const { nudges, language } = (await req.json()) as { nudges: Nudge[]; language: string };
  if (!aiAvailable() || !nudges?.length) return Response.json({ items: null, reason: "ai_unavailable" });

  try {
    const input = nudges.map((n) => ({ ruleId: n.ruleId, title: n.title, reason: n.reason, action: n.action }));
    const out = await structuredCall({
      system: SYSTEM,
      content: `Language: ${language}\n\nNudges:\n${JSON.stringify(input, null, 2)}`,
      schema: Schema,
    });
    if (!out) return Response.json({ items: null, reason: "refused" });
    // Drop anything that doesn't map to a rule we sent — the AI can't invent nudges.
    const ids = new Set(nudges.map((n) => n.ruleId));
    return Response.json({ items: out.items.filter((i: { ruleId: string }) => ids.has(i.ruleId)) });
  } catch (e) {
    console.error("explain failed", e);
    return Response.json({ items: null, reason: "error" });
  }
}
