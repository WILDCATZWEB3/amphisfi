import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

const SYSTEM = `You rewrite a trader's draft profile bio for Amphis, a Robinhood Chain trader reputation platform.
Rules:
- Keep only facts present in the draft. Never invent or add trading claims, returns, PnL, win rates, track records, followers, titles, years of experience, or any numbers not in the draft.
- If the draft makes performance claims, drop or soften them rather than amplifying them.
- Concise, polished, confident but understated. No emojis, no hashtags, no quotes around the output.
- Maximum 160 characters. Output only the rewritten bio text.`;

export async function rewriteBio(draft: string, signal?: AbortSignal): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured.");
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    system: SYSTEM,
    prompt: `Draft bio:\n${draft}`,
    ...(signal ? { abortSignal: signal } : {}),
    providerOptions: {
      openai: {
        store: false,
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  const text = (await result.text).trim().replace(/^["']|["']$/g, "");
  if (!text) throw new Error("The AI couldn't rewrite this bio. Try editing it yourself.");
  return text.slice(0, 160);
}
