import Anthropic from "@anthropic-ai/sdk";
import { betaStandardSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/beta/standard-schema";
import type { z } from "zod";

export const MODEL = process.env.CARENUDGE_MODEL ?? "claude-opus-5-5";

let client: Anthropic | null = null;

export function aiAvailable() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function getClient() {
  client ??= new Anthropic();
  return client;
}

export type UserContent = Anthropic.Beta.Messages.BetaContentBlockParam[] | string;

/**
 * One structured-output call. Returns null on refusal or parse failure so callers
 * can fall back to deterministic text — the demo must never hard-fail on the AI.
 */
export async function structuredCall<S extends z.ZodType>(opts: {
  system: string;
  content: UserContent;
  schema: S;
  effort?: "low" | "medium" | "high";
}): Promise<z.infer<S> | null> {
  const response = await getClient().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: opts.effort ?? "low", format: betaStandardSchemaOutputFormat(opts.schema) },
    system: opts.system,
    messages: [{ role: "user", content: opts.content }],
  });
  if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") return null;
  return (response.parsed_output as z.infer<S> | null) ?? null;
}
