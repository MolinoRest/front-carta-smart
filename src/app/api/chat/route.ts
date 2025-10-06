export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { chatCompletion, type ChatMessage } from "@/views/chatBotView/services/openai.server";

// ---- type guards seguros ----
type ChatRole = ChatMessage["role"]; // 'user' | 'assistant' | 'system'
interface ChatRequest { messages: ChatMessage[]; }

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object";
}

function isChatMessage(v: unknown): v is ChatMessage {
  if (!isRecord(v)) return false;
  const role = v.role;
  const content = v.content;
  const validRole = role === "user" || role === "assistant" || role === "system";
  return validRole && typeof content === "string";
}

function isChatRequest(v: unknown): v is ChatRequest {
  return isRecord(v) && Array.isArray(v.messages) && v.messages.every(isChatMessage);
}

function normalizeError(e: unknown): { status: number; error: string } {
  if (isRecord(e)) {
    const status =
      (typeof e.status === "number" && e.status) ||
      (isRecord(e.response) && typeof e.response.status === "number" && e.response.status) ||
      500;

    const error =
      (isRecord(e.response) && isRecord(e.response.data) && typeof e.response.data.error === "string" && e.response.data.error) ||
      (typeof e.message === "string" && e.message) ||
      "Internal Server Error";

    return { status, error };
  }
  return { status: 500, error: "Internal Server Error" };
}

// ---- handler ----
export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error("Falta OPENAI_API_KEY");
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    const json: unknown = await req.json().catch(() => null);
    if (!isChatRequest(json)) {
      return NextResponse.json({ error: "Invalid payload: 'messages' array is required" }, { status: 400 });
    }

    const { messages } = json;

    if (messages.length === 0) {
      return NextResponse.json({ error: "Empty 'messages' array" }, { status: 400 });
    }

    const reply = await chatCompletion(messages, { temperature: 0.7 });
    return NextResponse.json({ reply });
  } catch (err: unknown) {
    // Log detallado sin usar any
    console.error("API /api/chat error →", err);
    const { status, error } = normalizeError(err);
    return NextResponse.json({ error }, { status });
  }
}
