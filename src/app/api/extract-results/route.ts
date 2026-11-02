import { z } from "zod";
import { aiAvailable, structuredCall } from "@/lib/claude";
import { requireUser } from "@/lib/session";

// Reads values off a photo of a lab report and returns a DRAFT. Nothing is saved here: the
// doctor must review, edit and confirm each value before it is stored (see /api/results).

const Schema = z.object({
  readable: z.boolean(),
  results: z.array(
    z.object({
      test: z.string(),
      value: z.number().nullable(),
      unit: z.string(),
      date: z.string(), // yyyy-mm-dd, or empty if not printed
      rangeLow: z.number().nullable(),
      rangeHigh: z.number().nullable(),
    }),
  ),
});

const SYSTEM = `You read photos of laboratory reports for a doctor and transcribe the values.

Hard rules:
- Transcribe only what is printed. If a value, unit, date or range is missing or unclear, use null or an empty string. Never guess.
- rangeLow and rangeHigh are the reference range PRINTED on the report for that test. Do not supply a range from your own knowledge.
- Do not interpret results, do not say whether a value is normal, high or low, and do not add advice.
- If the image is not a lab report, set readable=false and return no results.`;

export async function POST(req: Request) {
  const auth = await requireUser("doctor");
  if (auth instanceof Response) return auth;
  if (!aiAvailable()) {
    return Response.json({ error: "Reading reports needs the AI service. Enter the values by hand instead." }, { status: 503 });
  }

  const body = (await req.json().catch(() => null)) as { imageBase64?: string; mediaType?: "image/jpeg" | "image/png" | "image/webp" } | null;
  if (!body?.imageBase64 || !body.mediaType) return Response.json({ error: "Please upload an image of the report." }, { status: 400 });

  try {
    const out = await structuredCall({
      system: SYSTEM,
      effort: "medium",
      schema: Schema,
      content: [
        { type: "image", source: { type: "base64", media_type: body.mediaType, data: body.imageBase64 } },
        { type: "text", text: "Transcribe the test values on this report." },
      ],
    });
    if (!out || !out.readable) return Response.json({ error: "Couldn't read values from this image. Enter them by hand instead." }, { status: 422 });
    return Response.json({ draft: out.results.filter((r) => r.value !== null) });
  } catch (e) {
    console.error("extract-results failed", e);
    return Response.json({ error: "Something went wrong reading the report." }, { status: 500 });
  }
}
