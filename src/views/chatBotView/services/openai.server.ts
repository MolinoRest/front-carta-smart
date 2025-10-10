// NO lo importes en componentes client (solo API).
import OpenAI from "openai";

export type ChatRole = "user" | "assistant" | "system";
export type ChatMessage = { role: ChatRole; content: string };

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function chatCompletion(
  messages: ChatMessage[],
  opts?: { model?: string; temperature?: number; max_tokens?: number }
) {
  const completion = await client.chat.completions.create({
    model: opts?.model ?? "gpt-4o",
    messages,
    temperature: opts?.temperature ?? 0.3,
    ...(opts?.max_tokens ? { max_tokens: opts.max_tokens } : {}),
  });
  return completion.choices[0]?.message?.content ?? "";
}
