/**
 * Minimal Gemini client for AI oracle resolutions and agent reasoning.
 * Uses the v1beta generateContent endpoint with API key.
 *
 * NOTE: Rotate the key shared in chat. Configure via GEMINI_API_KEY env var.
 */

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export interface GeminiOptions {
  model?: string;
  temperature?: number;
  systemInstruction?: string;
  responseMimeType?: "text/plain" | "application/json";
}

export async function gemini(
  prompt: string,
  opts: GeminiOptions = {},
): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured");

  const model = opts.model ?? process.env.GEMINI_MODEL ?? "gemini-1.5-flash";
  const url = `${ENDPOINT}/${model}:generateContent?key=${key}`;

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    ...(opts.systemInstruction
      ? { systemInstruction: { parts: [{ text: opts.systemInstruction }] } }
      : {}),
    generationConfig: {
      temperature: opts.temperature ?? 0.2,
      responseMimeType: opts.responseMimeType ?? "text/plain",
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

export interface OracleVerdict {
  outcome: "YES" | "NO" | "INVALID";
  confidence: number; // 0..1
  reasoning: string;
}

/**
 * Ask Gemini to act as a single oracle agent. The caller invokes this
 * N times (with different framings/temperatures) and computes consensus.
 */
export async function resolveWithGemini(
  question: string,
  context: string,
  agentPersona: string,
): Promise<OracleVerdict> {
  const sys = `You are an impartial oracle agent (${agentPersona}) for a decentralized prediction market. Return STRICT JSON: {"outcome":"YES"|"NO"|"INVALID","confidence":0..1,"reasoning":"..."}.`;
  const text = await gemini(
    `Question: ${question}\n\nContext / evidence:\n${context}\n\nRespond with JSON only.`,
    { systemInstruction: sys, responseMimeType: "application/json", temperature: 0.3 },
  );
  try {
    const parsed = JSON.parse(text);
    if (parsed.outcome !== "YES" && parsed.outcome !== "NO" && parsed.outcome !== "INVALID") {
      throw new Error("bad outcome");
    }
    return {
      outcome: parsed.outcome,
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
      reasoning: String(parsed.reasoning ?? "").slice(0, 1000),
    };
  } catch {
    return { outcome: "INVALID", confidence: 0, reasoning: "parse_error: " + text.slice(0, 200) };
  }
}
