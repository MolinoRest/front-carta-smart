export const runtime = "nodejs"; // fuerza runtime Node

import { NextRequest, NextResponse } from "next/server";
import { chatCompletion, type ChatMessage } from "@/views/chatBotView/services/openai.server";

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error("Falta OPENAI_API_KEY");
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    const json = await req.json().catch(() => null);
    if (!json || !Array.isArray(json.messages)) {
      return NextResponse.json({ error: "Invalid payload: 'messages' array is required" }, { status: 400 });
    }

    const messages = json.messages as ChatMessage[];
    if (messages.length === 0) {
      return NextResponse.json({ error: "Empty 'messages' array" }, { status: 400 });
    }

    const reply = await chatCompletion(messages, { temperature: 0.7 });
    return NextResponse.json({ reply });
  } catch (err: any) {
    // Log detallado en servidor
    console.error("API /api/chat error →", {
      status: err?.status,
      message: err?.message,
      data: err?.response?.data,
    });

    const status = err?.status ?? err?.response?.status ?? 500;
    const error =
      err?.response?.data?.error ||
      err?.message ||
      "Internal Server Error";
    return NextResponse.json({ error }, { status });
  }
}
