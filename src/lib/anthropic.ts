// Server-only Anthropic client + a structured-JSON helper for the compliance officer.
// This is the REAL LLM layer: one genuine Claude call constrained to a JSON schema
// (structured outputs). Never import into a client component — it reads ANTHROPIC_API_KEY.

import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config";

/** True when a real Anthropic key is configured — gates the live LLM officer. */
export function llmConfigured(): boolean {
  return !!config.anthropicKey;
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: config.anthropicKey });
  return client;
}

export interface SystemBlock {
  text: string;
  /** Mark a stable block to cache the shared prefix (prompt caching). */
  cache?: boolean;
}

export interface StructuredCallOpts {
  model: string;
  system: SystemBlock[];
  user: string;
  /** JSON Schema the response must conform to (structured outputs). */
  schema: Record<string, unknown>;
  maxTokens?: number;
}

/**
 * Make one real Claude call constrained to a JSON schema and return the parsed object.
 * Uses `output_config.format` (structured outputs) so the response is guaranteed-shaped.
 */
export async function structuredCall<T>(opts: StructuredCallOpts): Promise<T> {
  const c = getClient();
  const system = opts.system.map((b) => ({
    type: "text" as const,
    text: b.text,
    ...(b.cache ? { cache_control: { type: "ephemeral" as const } } : {}),
  }));

  const res = await c.messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 1024,
    system,
    messages: [{ role: "user", content: opts.user }],
    output_config: { format: { type: "json_schema", schema: opts.schema } },
  });

  const text = res.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
  if (!text) throw new Error("Anthropic response contained no text block");
  return JSON.parse(text) as T;
}
