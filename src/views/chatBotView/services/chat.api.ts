import axios from "axios";
import type { ChatMessage } from "./openai.server"; // solo tipos

export const chatApi = {
  async send(messages: ChatMessage[]) {
    const { data } = await axios.post<{ reply: string }>("/api/chat", { messages });
    return data.reply;
  },
};
