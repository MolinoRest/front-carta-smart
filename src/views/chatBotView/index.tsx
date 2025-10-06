"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { chatApi } from "./services/chat.api";
import NavbarComponent from "@/components/navbar";

type Msg = { role: "user" | "assistant"; content: string };
type Dish = {
  id: string;
  name: string;
  price: number;
  category: "Entradas" | "Fondos" | "Bebidas" | "Postres";
};
type CartItem = { dish: Dish; qty: number };

// ======= MENÚ (editable) =======
const MENU: Dish[] = [
  { id: "e1", name: "Causa Limeña", price: 18, category: "Entradas" },
  { id: "e2", name: "Papa a la Huancaína", price: 16, category: "Entradas" },
  { id: "f1", name: "Lomo Saltado", price: 32, category: "Fondos" },
  { id: "f2", name: "Aji de Gallina", price: 28, category: "Fondos" },
  { id: "f3", name: "Arroz con Pollo", price: 26, category: "Fondos" },
  { id: "b1", name: "Chicha Morada 500ml", price: 8, category: "Bebidas" },
  { id: "b2", name: "Limonada 500ml", price: 7, category: "Bebidas" },
  { id: "p1", name: "Suspiro a la Limeña", price: 14, category: "Postres" },
  { id: "p2", name: "Mazamorra Morada", price: 12, category: "Postres" },
];

function currency(n: number) { return `S/ ${n.toFixed(2)}`; }
function findDishByName(name: string) {
  const normalized = name.trim().toLowerCase();
  return MENU.find(d => d.name.toLowerCase() === normalized);
}

export default function ChatBotView() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant", content:
        "¡Hola! Soy tu asistente de pedidos. Escribe /menu para ver el menú, /carrito para ver tu pedido, /vaciar para empezar de cero y /confirmar cuando quieras finalizar."
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);

  const [cart, setCart] = useState<Record<string, CartItem>>({});

  useEffect(() => {
    viewportRef.current?.scrollTo({ top: viewportRef.current.scrollHeight });
  }, [messages, loading]);

  const total = useMemo(
    () => Object.values(cart).reduce((acc, it) => acc + it.dish.price * it.qty, 0),
    [cart]
  );

  // ================== COMANDOS POR TEXTO ==================
  function renderMenuText() {
    const byCat: Record<Dish["category"], Dish[]> = { Entradas: [], Fondos: [], Bebidas: [], Postres: [] };
    MENU.forEach(d => byCat[d.category].push(d));
    const lines: string[] = [];
    (["Entradas", "Fondos", "Bebidas", "Postres"] as Dish["category"][]).forEach(cat => {
      lines.push(`*${cat}*`);
      byCat[cat].forEach(d => lines.push(`- ${d.name} — ${currency(d.price)}`));
      lines.push("");
    });
    return lines.join("\n");
  }

  function renderCartText() {
    if (Object.keys(cart).length === 0) return "Tu carrito está vacío.";
    const lines = Object.values(cart).map(it => `- ${it.qty} x ${it.dish.name} = ${currency(it.qty * it.dish.price)}`);
    lines.push(`\nTotal: ${currency(total)}`);
    return lines.join("\n");
  }

  function addToCartByName(name: string, qty = 1) {
    const dish = findDishByName(name);
    if (!dish) return `No encontré “${name}” en el menú. Escribe /menu para ver opciones.`;
    setCart(prev => {
      const ex = prev[dish.id];
      const nextQty = (ex?.qty ?? 0) + qty;
      return { ...prev, [dish.id]: { dish, qty: nextQty } };
    });
    return `Agregado: ${qty} x ${dish.name}.`;
  }

  function removeFromCartByName(name: string, qty = 1) {
    const dish = findDishByName(name);
    if (!dish) return `No encontré “${name}” en el menú.`;
    setCart(prev => {
      const ex = prev[dish.id];
      if (!ex) return prev;
      const nextQty = ex.qty - qty;
      if (nextQty <= 0) {
        const { [dish.id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [dish.id]: { ...ex, qty: nextQty } };
    });
    return `Quitado: ${qty} x ${dish.name}.`;
  }

  // ================== PARSEO DE ACCIONES DEL ASISTENTE ==================
  // El asistente puede incluir al final un bloque:
  //
  // ```order
  // { "op":"add"|"remove"|"clear"|"confirm", "item":"Lomo Saltado", "qty":2 }
  // ```
  //
  function applyAssistantActions(text: string): string[] {
    const applied: string[] = [];
    const regex = /```order\s*([\s\S]*?)```/gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      try {
        const action = JSON.parse(match[1].trim()) as { op: string; item?: string; qty?: number };
        const qty = Math.max(1, Number(action.qty ?? 1));
        if (action.op === "add" && action.item) {
          applied.push(addToCartByName(action.item, qty));
        } else if (action.op === "remove" && action.item) {
          applied.push(removeFromCartByName(action.item, qty));
        } else if (action.op === "clear") {
          setCart({});
          applied.push("Carrito vaciado.");
        } else if (action.op === "confirm") {
          applied.push("Confirmación recibida. El asistente te pedirá datos de entrega.");
        }
      } catch {
        // ignora bloques mal formados
      }
    }
    return applied;
  }

  // ================== CHAT ==================
  async function sendMessage(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    // intercepta comandos locales
    if (text === "/menu") {
      setMessages(prev => [...prev, { role: "user", content: text }, { role: "assistant", content: renderMenuText() }]);
      setInput(""); return;
    }
    if (text === "/carrito") {
      setMessages(prev => [...prev, { role: "user", content: text }, { role: "assistant", content: renderCartText() }]);
      setInput(""); return;
    }
    if (text === "/vaciar") {
      setCart({});
      setMessages(prev => [...prev, { role: "user", content: text }, { role: "assistant", content: "Listo, tu carrito está vacío." }]);
      setInput(""); return;
    }
    if (text.startsWith("/add ")) {
      const name = text.slice(5).trim();
      const msg = addToCartByName(name, 1);
      setMessages(prev => [...prev, { role: "user", content: text }, { role: "assistant", content: msg }]);
      setInput(""); return;
    }
    if (text.startsWith("/remove ")) {
      const name = text.slice(8).trim();
      const msg = removeFromCartByName(name, 1);
      setMessages(prev => [...prev, { role: "user", content: text }, { role: "assistant", content: msg }]);
      setInput(""); return;
    }
    if (text === "/confirmar" || text === "/confirm") {
      // solo construye un resumen para que el asistente pida datos y valide
      const resumen = renderCartText();
      const userMsg = `Deseo confirmar este pedido:\n${resumen}\nPor favor indícame cómo finalizar.`;
      const next = [...messages, { role: "user", content: userMsg } as Msg];
      setMessages(next);
      setInput("");
      await callAssistant(next);
      return;
    }

    // flujo normal hacia el asistente
    const next = [...messages, { role: "user", content: text } as Msg];
    setMessages(next);
    setInput("");
    await callAssistant(next);
  }

  async function callAssistant(nextMessages: Msg[]) {
    setLoading(true);
    try {
      // Prompt del sistema: TODO por chat, asistente debe devolver bloque ```order``` si modifica carrito
      const systemPrompt =
        "Eres un asistente de pedidos para un restaurante. Interactúas SOLO por chat. " +
        "Si el cliente solicita agregar, quitar, vaciar o confirmar, responde normalmente y, " +
        "AL FINAL de tu mensaje agrega un bloque de código con el lenguaje 'order' que contenga un JSON con la acción. " +
        "Formato: ```order\n{ \"op\":\"add|remove|clear|confirm\", \"item\":\"Nombre exacto del menú\", \"qty\":N }\n``` " +
        "Si no hay cambios en carrito, no incluyas ningún bloque 'order'. " +
        "Pide datos de entrega (nombre y teléfono) solo cuando el cliente quiera confirmar.";

      const shortMenu = MENU.map(d => ({ name: d.name, price: d.price, category: d.category }));
      const cartSummary = Object.values(cart).map(it => ({
        name: it.dish.name, qty: it.qty, unit_price: it.dish.price, line_total: it.dish.price * it.qty
      }));

      const reply = await chatApi.send([
        { role: "system", content: systemPrompt },
        { role: "assistant", content: `MENÚ: ${JSON.stringify(shortMenu)}` },
        { role: "assistant", content: `CARRITO_ACTUAL: ${JSON.stringify(cartSummary)} | TOTAL: ${currency(total)}` },
        ...nextMessages,
      ]);

      // aplica acciones embebidas
      const effects = applyAssistantActions(reply);
      const replyWithNote = effects.length
        ? `${reply}\n\n_${effects.join(" ")}_\n\n${renderCartText()}`
        : reply;

      setMessages(prev => [...prev, { role: "assistant", content: replyWithNote }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Error al contactar al servicio." }]);
    } finally {
      setLoading(false);
    }
  }

  // Enter envía, Shift+Enter salto de línea
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  return (
    <div>
      <NavbarComponent></NavbarComponent>
      <div style={{ maxWidth: 800, margin: "32px auto", padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <h1 style={{ margin: 0 }}>Asistente de Pedidos (solo chat)</h1>
        </div>

        <div ref={viewportRef} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, height: 520, overflowY: "auto", background: "#fafafa" }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", margin: "8px 0" }}>
              <div style={{
                maxWidth: "85%", padding: "10px 12px", borderRadius: 12, whiteSpace: "pre-wrap",
                background: m.role === "user" ? "#2563eb" : "white", color: m.role === "user" ? "white" : "black",
                boxShadow: "0 1px 2px rgba(0,0,0,0.06)"
              }}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && <p style={{ opacity: 0.7 }}>pensando…</p>}
        </div>

        <form onSubmit={sendMessage} style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ej.: 2 Lomo Saltado y 1 Chicha Morada /menu /carrito /vaciar /confirmar"
            rows={2}
            style={{ flex: 1, resize: "none", padding: 10, borderRadius: 8, border: "1px solid #000000" }}
          />
          <button type="submit" disabled={loading || input.trim().length === 0}
            style={{ padding: "0 16px", borderRadius: 8, border: "1px solid #000000", minWidth: 100 }}>
            {loading ? "Enviando…" : "Enviar"}
          </button>
        </form>
      </div>
    </div>

  );
}