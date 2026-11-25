// Server-only: any OpenAI-compatible chat API (Groq, Cerebras, OpenRouter, ...), chosen by env vars.
//   GROQ_API_KEY  the only one needed (Groq)
//   LLM_MODEL     optional, default openai/gpt-oss-120b
//   LLM_BASE_URL + LLM_API_KEY  optional, to use another provider instead

type Message = { role: "system" | "user" | "assistant"; content: string };

function config() {
  const key = process.env.LLM_API_KEY || process.env.GROQ_API_KEY;
  if (key) {
    return { baseUrl: process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1", key, model: process.env.LLM_MODEL || "openai/gpt-oss-120b" };
  }
  return null;
}

export function aiAvailable(): boolean {
  const c = config();
  return !!(c && c.model);
}

export class AiUnavailableError extends Error {}

/** Ask for a JSON object back. Throws AiUnavailableError when no provider works, so callers can fall back. */
export async function askJson<T = unknown>(messages: Message[], opts: { temperature?: number; timeoutMs?: number } = {}): Promise<T> {
  const c = config();
  if (!c || !c.model) throw new AiUnavailableError("No AI provider configured");
  let res: Response;
  try {
    res = await fetch(`${c.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${c.key}` },
      body: JSON.stringify({ model: c.model, messages, temperature: opts.temperature ?? 0.2, response_format: { type: "json_object" } }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
      cache: "no-store",
    });
  } catch (e) {
    throw new AiUnavailableError(`AI request failed: ${(e as Error).message}`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`LLM ${res.status}: ${body.slice(0, 300)}`);
    throw new AiUnavailableError(res.status === 401 || res.status === 402 || res.status === 429 ? "AI provider refused (key, credit or rate limit)" : `AI error ${res.status}`);
  }
  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";
  try {
    return JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, "")) as T;
  } catch {
    throw new AiUnavailableError("AI returned something that wasn't JSON");
  }
}

/** Keep AI wording on the "fits your idea" side, never "buy this". */
export function softenAdvice(text: string): string {
  return text
    .replace(/\b(should|must) (buy|invest in)\b/gi, "could look at")
    .replace(/\brecommend(ed|s|ation)?\b/gi, "suggest$1")
    .replace(/\bguaranteed?\b/gi, "likely");
}
