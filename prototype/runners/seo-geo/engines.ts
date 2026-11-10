// The AI engines being MEASURED. These stay external by design: we record what real assistants tell buyers.
import Anthropic from "@anthropic-ai/sdk";

export type EngineResult = {
  answer_text: string;
  cited_urls: string[];
  model: string;
  cost_usd: number;
  input_tokens: number;
  output_tokens: number;
  searches: number;
  error: string | null;
};

// What a buyer would see: a plain question, no system prompt steering the answer.
const anthropic = new Anthropic();
export const CLAUDE_MODEL = process.env.GEO_CLAUDE_MODEL ?? "claude-haiku-5-5";
const CLAUDE_PRICE: Record<string, [number, number]> = { "claude-haiku-5-5": [0.1e-6, 0.5e-6], "claude-sonnet-5-5": [2e-6, 10e-6] };
// Haiku 5.5 takes the basic web search tool; Sonnet/Opus 5.5 take the dynamic-filtering variant.
const searchTool = CLAUDE_MODEL.includes("haiku")
  ? { type: "web_search_20250305" as const, name: "web_search" as const, max_uses: 3 }
  : { type: "web_search_20260209" as const, name: "web_search" as const, max_uses: 3 };

/** `country` (ISO alpha-2, from markets.ts) localizes web search results to the buyer's market (plan Q24). */
export async function askClaude(question: string, country?: string): Promise<EngineResult> {
  const tool = country ? { ...searchTool, user_location: { type: "approximate" as const, country } } : searchTool;
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: question }];
  let text = "", inTok = 0, outTok = 0, searches = 0;
  const urls = new Set<string>();
  try {
    for (let turn = 0; turn < 4; turn++) {
      const r = await anthropic.messages.create({ model: CLAUDE_MODEL, max_tokens: 4000, tools: [tool], messages });
      inTok += r.usage.input_tokens; outTok += r.usage.output_tokens;
      searches += r.usage.server_tool_use?.web_search_requests ?? 0;
      for (const b of r.content) {
        if (b.type === "text") {
          text += b.text;
          for (const c of b.citations ?? []) if (c.type === "web_search_result_location") urls.add(c.url);
        }
      }
      if (r.stop_reason === "pause_turn") { messages.push({ role: "assistant", content: r.content }); continue; }
      if (r.stop_reason === "refusal") throw new Error("refusal");
      break;
    }
    const [pi, po] = CLAUDE_PRICE[CLAUDE_MODEL] ?? [0, 0];
    return { answer_text: text.trim(), cited_urls: [...urls], model: CLAUDE_MODEL, cost_usd: inTok * pi + outTok * po + searches * 0.01, input_tokens: inTok, output_tokens: outTok, searches, error: null };
  } catch (e) {
    return { answer_text: text, cited_urls: [...urls], model: CLAUDE_MODEL, cost_usd: 0, input_tokens: inTok, output_tokens: outTok, searches, error: (e as Error).message };
  }
}

// Gemini with Google Search grounding (paid tier; grounding free up to 5,000 prompts/month). Plain REST, no SDK.
// Free-tier grounding only exists on 2.5 Flash, which is closed to new users (2026-11-09).
// No market parameter: toolConfig.retrievalConfig (latLng, languageCode) is accepted but search ignored it
// (2026-11-09 test: Paris location still gave US-dollar CleanMyMac prices). The question's language is the only signal.
export const GEMINI_MODEL = process.env.GEO_GEMINI_MODEL ?? "gemini-3.8-flash";
const GEMINI_PRICE: Record<string, [number, number]> = { "gemini-3.8-flash": [0.75e-6, 3.75e-6] }; // until 2026-12-31, then doubles
export async function askGemini(question: string): Promise<EngineResult> {
  const base = { model: GEMINI_MODEL, searches: 0 };
  const [gi, go] = GEMINI_PRICE[GEMINI_MODEL] ?? [0, 0];
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY ?? "" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: question }] }], tools: [{ google_search: {} }] }),
      signal: AbortSignal.timeout(90000),
    });
    const j: any = await res.json();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(j.error ?? j).slice(0, 200)}`);
    const cand = j.candidates?.[0];
    const text = (cand?.content?.parts ?? []).map((p: any) => p.text ?? "").join("").trim();
    // Grounding chunks link through Google redirects; the title carries the source domain.
    const chunks: any[] = cand?.groundingMetadata?.groundingChunks ?? [];
    const cited = chunks.map(c => c.web?.title ? `https://${c.web.title}` : c.web?.uri).filter(Boolean);
    const searches = cand?.groundingMetadata?.webSearchQueries?.length ?? 0;
    const inT = j.usageMetadata?.promptTokenCount ?? 0, outT = (j.usageMetadata?.candidatesTokenCount ?? 0) + (j.usageMetadata?.thoughtsTokenCount ?? 0);
    return { ...base, answer_text: text, cited_urls: [...new Set(cited)], input_tokens: inT, output_tokens: outT, cost_usd: inT * gi + outT * go, searches, error: text ? null : "empty answer" };
  } catch (e) {
    return { ...base, answer_text: "", cited_urls: [], input_tokens: 0, output_tokens: 0, cost_usd: 0, error: (e as Error).message };
  }
}
