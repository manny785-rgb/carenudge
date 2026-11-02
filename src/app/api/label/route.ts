import { z } from "zod";
import { aiAvailable, structuredCall } from "@/lib/claude";

const Field = z.object({ original: z.string(), translated: z.string() });

const Schema = z.object({
  readable: z.boolean(),
  medicineName: Field,
  strength: Field,
  howToTake: Field,
  warnings: z.array(Field),
  expiry: z.string(),
  unclearParts: z.array(z.string()),
  readAloud: z.string(),
});

const SYSTEM = `You read photos of medicine labels (pharmacy dispensing labels or packaging) for caregivers in Singapore and translate them.

Hard rules:
- Transcribe only what is printed. If a part is blurry, cut off or missing, use an empty string and list it in unclearParts. Never guess a dose, frequency or medicine name.
- Do not add advice, side effects or interactions that are not printed on the label.
- "translated" fields are in the requested language; keep numbers and units exactly as printed.
- readAloud: a short, natural script in the requested language covering name, how to take it, and printed warnings, ending with a reminder to check with the pharmacist if unsure.
- If the image is not a medicine label, set readable=false and leave fields empty.`;

export async function POST(req: Request) {
  if (!aiAvailable()) {
    return Response.json({ error: "LabelSpeak needs the AI service. Set ANTHROPIC_API_KEY on the server." }, { status: 503 });
  }
  const { imageBase64, mediaType, language } = (await req.json()) as {
    imageBase64: string;
    mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
    language: string;
  };
  try {
    const out = await structuredCall({
      system: SYSTEM,
      effort: "medium",
      schema: Schema,
      content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
        { type: "text", text: `Translate into: ${language}` },
      ],
    });
    if (!out) return Response.json({ error: "Couldn't read this label. Please try a clearer photo or ask your pharmacist." }, { status: 422 });
    return Response.json(out);
  } catch (e) {
    console.error("label failed", e);
    return Response.json({ error: "Something went wrong reading the label." }, { status: 500 });
  }
}
