"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { chatApi } from "./services/chat.api";
import NavbarComponent from "@/components/navbar";

type Msg = { role: "user" | "assistant" | "system"; content: string };
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

type Action = { op: "add" | "remove" | "clear" | "confirm" | "set"; item?: string; qty?: number };

export default function ChatBotView() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "¡Hola! Soy tu asistente de pedidos. Escribe /menu para ver el menú, /carrito para ver tu pedido, /vaciar para empezar de cero y /confirmar cuando quieras finalizar."
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);

  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [pendingActions, setPendingActions] = useState<Action[] | null>(null);

  useEffect(() => {
    viewportRef.current?.scrollTo({ top: viewportRef.current.scrollHeight });
  }, [messages, loading]);

  const total = useMemo(
    () => Object.values(cart).reduce((acc, it) => acc + it.dish.price * it.qty, 0),
    [cart]
  );

  // ================== UTILIDADES UI ==================
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

  function renderCartMarkdown(cartObj: Record<string, CartItem>) {
    const items = Object.values(cartObj || {});
    if (!items.length) return "_Carrito vacío_";
    const lines: string[] = [];
    lines.push("**🧺 Carrito de compras**");
    lines.push("");
    lines.push("| Cant. | Producto | Precio | Subtotal |");
    lines.push("|:-----:|:-------- | -----:| -------:|");
    let t = 0;
    for (const it of items) {
      const name = it.dish?.name ?? "—";
      const qty = it.qty ?? 0;
      const unit = it.dish?.price ?? 0;
      const sub = unit * qty;
      t += sub;
      lines.push(`| ${qty} | ${name} | ${currency(unit)} | ${currency(sub)} |`);
    }
    lines.push("");
    lines.push(`**Total: ${currency(t)}**`);
    lines.push("");
    lines.push("_Escribe **agregar [producto]**, **quitar [producto]** o **vaciar** para modificar._");
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

  // ================== Parseo y helpers ==================
  function extractFence(text: string, fence: "order" | "json" | "pending") {
    const re = new RegExp("```" + fence + "\\s*([\\s\\S]*?)```", "i");
    return text.match(re)?.[1] ?? null;
  }
  function parseActions(raw?: string | null): Action[] {
    if (!raw) return [];
    const norm = (t: string) =>
      t.replace(/([{,\s])([A-Za-z_]\w*)\s*:/g, '$1"$2":')
        .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');

    const toArr = (t: string) => {
      const p = JSON.parse(t);
      return Array.isArray(p) ? p : [p];
    };

    try { return toArr(raw.trim()); } catch {}
    try { return toArr(norm(raw.trim())); } catch {}

    const out: Action[] = [];
    for (const line of raw.split(/\r?\n/)) {
      const l = line.trim(); if (!l) continue;
      try { out.push(...toArr(l)); continue; } catch {}
      try { out.push(...toArr(norm(l))); } catch {}
    }
    return out;
  }
  function applyActionsToDraft(draft: Record<string, CartItem>, actions: Action[]) {
    const add = (name: string, qty = 1) => {
      const dish = findDishByName(name); if (!dish) return;
      const ex = draft[dish.id];
      draft[dish.id] = { dish, qty: (ex?.qty ?? 0) + qty };
    };
    const remove = (name: string, qty = 1) => {
      const dish = findDishByName(name); if (!dish) return;
      const ex = draft[dish.id]; if (!ex) return;
      const q = ex.qty - qty;
      if (q <= 0) delete draft[dish.id]; else draft[dish.id] = { dish: ex.dish, qty: q };
    };
    const setQty = (name: string, qty = 0) => {
      const dish = findDishByName(name); if (!dish) return;
      if (qty <= 0) { delete draft[dish.id]; return; }
      draft[dish.id] = { dish, qty };
    };

    for (const a of actions) {
      const op = String(a.op || "").toLowerCase() as Action["op"];
      const item = a.item;
      const qty = Math.max(0, Number(a.qty ?? 0));
      if (op === "add" && item) add(item, Math.max(1, qty || 1));
      else if (op === "remove" && item) remove(item, Math.max(1, qty || 1));
      else if (op === "clear") { for (const k of Object.keys(draft)) delete draft[k]; }
      else if (op === "set" && item) setQty(item, qty);
    }
    return draft;
  }

  // cantidad desde el texto del usuario (dígitos, +1, x2, palabras 1–10)
  function extractQtyFromText(t: string): number | null {
    const s = (t || "").toLowerCase();
    const d = s.match(/(?<![\w.])\d+(?![\w.])/);
    if (d) return Number(d[0]);
    const plus = s.match(/[+x×]\s*(\d+)/);
    if (plus) return Number(plus[1]);
    const map: Record<string, number> = {
      "uno": 1, "una": 1, "dos": 2, "tres": 3, "cuatro": 4, "cinco": 5,
      "seis": 6, "siete": 7, "ocho": 8, "nueve": 9, "diez": 10
    };
    for (const w of Object.keys(map)) if (new RegExp(`\\b${w}\\b`, "i").test(s)) return map[w];
    return null;
  }

  // ¿El mensaje menciona explícitamente algún plato del menú?
  function mentionsAnyDish(t: string): boolean {
    const s = (t || "").toLowerCase();
    return MENU.some(d => s.includes(d.name.toLowerCase()));
  }

  // ================== PARSEO de acciones (confiando en `order`) ==================
  function computeCartFromReply(text: string, base: Record<string, CartItem>) {
    const fenceRegex = /```(?:order|json)\s*([\s\S]*?)```/gi;
    let lastRaw: string | null = null;
    let m: RegExpExecArray | null;
    while ((m = fenceRegex.exec(text)) !== null) lastRaw = m[1];

    const draft: Record<string, CartItem> = { ...base };
    const normalize = (t: string) =>
      t.replace(/([{,\s])([A-Za-z_]\w*)\s*:/g, '$1"$2":').replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');

    const parseActions = (raw: string): Array<any> => {
      if (!raw) return [];
      const s = raw.trim();
      const tryParse = (x: string) => {
        const p = JSON.parse(x);
        return Array.isArray(p) ? p : [p];
      };
      try { return tryParse(s); } catch {}
      try { return tryParse(normalize(s)); } catch {}
      const out: any[] = [];
      for (const line of s.split(/\r?\n/)) {
        const l = line.trim(); if (!l) continue;
        try { out.push(JSON.parse(l)); continue; } catch {}
        try { out.push(JSON.parse(normalize(l))); } catch {}
      }
      return out;
    };

    if (!lastRaw) {
      const loose = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
      if (!loose) return draft;
      lastRaw = loose[1];
    }

    const actions = parseActions(lastRaw);
    return applyActionsToDraft(draft, actions);
  }

  // --- Limpiador visual (oculta bloques internos) ---
  function stripInternalBlocks(text: string) {
    let out = text.replace(/```(?:order|json|pending)[\s\S]*?```/gi, "");
    out = out.replace(/\n{3,}/g, "\n\n").trim();
    return out;
  }

  // ================== CHAT ==================
  async function sendMessage(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    // Si hay pending pero el usuario menciona un plato, NO aplicamos pending: es una nueva intención.
    if (pendingActions && !mentionsAnyDish(text)) {
      const qtyOverride = extractQtyFromText(text);
      setCart(prev => {
        const draft = { ...prev };
        const toApply = pendingActions.map(a =>
          qtyOverride != null && (a.op === "add" || a.op === "set")
            ? { ...a, qty: qtyOverride }
            : a
        );
        return applyActionsToDraft(draft, toApply);
      });
      setPendingActions(null);
      setMessages(prev => [...prev, { role: "user", content: text }, { role: "assistant", content: "¡Listo! 😊" }]);
      setInput("");
      return;
    }

    if (text === "/menu") {
      setMessages(prev => [...prev, { role: "user", content: text }, { role: "assistant", content: renderMenuText() }]);
      setInput(""); return;
    }
    if (text === "/carrito") {
      setMessages(prev => [...prev, { role: "user", content: text }, { role: "assistant", content: renderCartMarkdown(cart) }]);
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
      const resumen = renderCartMarkdown(cart);
      const userMsg = `Deseo confirmar este pedido:\n${resumen}\nPor favor indícame cómo finalizar.`;
      const next = [...messages, { role: "user", content: userMsg } as Msg];
      setMessages(next);
      setInput("");
      await callAssistant(next);
      return;
    }

    const next = [...messages, { role: "user", content: text } as Msg];
    setMessages(next);
    setInput("");
    await callAssistant(next);
  }

  // ======= callAssistant con prompt reforzado + logging =======
  async function callAssistant(nextMessages: Msg[]) {
    setLoading(true);
    try {
      const SYSTEM_PROMPT = `
        IDENTIDAD Y OBJETIVO
        ────────────────────────────────────────────────
        - Eres un asistente de pedidos para restaurantes.
        - Objetivo: entender el MENSAJE_ACTUAL (el último mensaje que acaba de escribir el cliente) y, si corresponde, ejecutar acciones sobre el carrito (agregar, quitar, ajustar, vaciar o confirmar) de forma inmediata y precisa.
        - Estilo: claro, humano y amable; frases breves; sin tecnicismos. Usa emojis con moderación.

        OBJETOS DE CONTEXTO (el sistema te los envía antes de cada respuesta)
        ────────────────────────────────────────────────
        - MENU: lista plana del menú (id, name, price, category).
        - CART_SUMMARY: estado actual del carrito: [{id,name,qty,unit_price}, ...].
        - ASSISTANT_LAST: el último texto que tú mismo respondiste (útil si dejaste una pregunta de confirmación).
        Úsalos únicamente como contexto de referencia.
        PROHIBIDO usarlos como fuente para añadir ítems en el bloque order o para “reconstruir” pedidos previos.
        Solo podrás emitir order con información que venga de:
        MENSAJE ACTUAL del cliente (contiene verbo de acción + ítem mapeable; si no dice cantidad, asume 1), o Confirmación directa a una sola pregunta concreta en ASSISTANT_LAST del tipo “¿Agrego <ITEM exacto>?”, pudiendo incluir un número (“2”, “+1”, “x2”). Nunca arrastres al order platos vistos en CART_SUMMARY o mencionados en turnos anteriores si el cliente no los pidió nuevamente ahora.
        Si falta el ítem o hay ambigüedad, no emitas order; formula una única pregunta de aclaración.

        SALIDA Y BLOQUE \`order\` (CRÍTICO)
        ────────────────────────────────────────────────
        - El bloque \`\`\`order\`\`\` es el **único** mecanismo para aplicar cambios reales al carrito.
        - **Consistencia texto ↔ order (regla dura):**
          - Si afirmas una acción en **pasado** (“Listo, agregué/quité/ajusté/confirmé… etc”), **DEBES** terminar tu mensaje con **un único** bloque \`\`\`order\`\`\` que refleje exactamente esas acciones (no pongas texto después del bloque).
          - Si **no** incluyes \`\`\`order\`\`\`, **no uses pasado**. Haz una **única** pregunta de aclaración y espera la respuesta.
        - **Solo delta del MENSAJE_ACTUAL (regla durísima):**
          - El bloque \`\`\`order\`\`\` debe contener **exclusivamente** lo que el cliente pidió **en el MENSAJE_ACTUAL** (o la confirmación directa a una única pregunta “¿Agrego <ITEM>?” hecha en ASSISTANT_LAST).
          - **No** arrastres al \`\`\`order\`\`\` platos ya presentes en el carrito ni pedidos de turnos anteriores, **a menos que el cliente los vuelva a mencionar ahora**.
        - **Cuándo emitir \`order\`:**
          - Emite \`\`\`order\`\`\` **solo si** el MENSAJE_ACTUAL contiene un **verbo de acción** (agrega/añade/pon/suma/mete/incorpora/quita/deja en/+1/x2/otra/uno más) **y** un **plato mapeable** del MENU. Si no indica cantidad pero es lógico, asume qty=1.
          - También emítelo si el MENSAJE_ACTUAL es “sí/ok/👍/2/+1/x2” **y** en ASSISTANT_LAST hiciste **una sola** pregunta concreta “¿Agrego <ITEM exacto>?” (usa ese <ITEM> y esa cantidad).
          - Si el MENSAJE_ACTUAL contiene cualquiera de estas frases, DEBES emitir order: 
            - SET (ajustar cantidad): “déjalo en N”, “deja en N”, “ajusta a N”, “ajústalo a N”, “ponlo en N”, “bájalo a N”, “súbelo a N”, “mejor solo N”, “que sean N”, “quiero N”, “cámbialo a N”.
              → {"op":"set","item":"<NOMBRE EXACTO>","qty":N}
            - REMOVE (quitar): “quita”, “saca”, “elimina”, “retira”, “borra”, “ya no quiero”, “remueve”.
              → Si dicen “quita 1 <plato>”: {"op":"remove","item":"<NOMBRE>","qty":1}.
              → Si dicen “quita <plato>” (sin número): set en 0 o remove con qty actual (elige uno y sé consistente).
            - Si el mensaje no menciona el plato pero ASSISTANT_LAST fue una única pregunta concreta sobre un ítem (“¿Agrego/Ajusto X?”), puedes aplicar el ajuste a ese ítem. Si hubo 2+ opciones, no ejecutes y pregunta “¿Sobre cuál ítem?”.
        - **Cuándo NO emitir \`order\`:**
          - Si falta plato o cantidad, o hay ambigüedad. En ese caso, formula **una única** pregunta de aclaración (propón 1–2 opciones si ayuda) y **no** uses pasado.
        - Ejemplos incorrectos (NO hacer):
          - Decir “agregué…” sin adjuntar \`\`\`order\`\`\`.
          - Enviar \`\`\`order\`\`\` y luego más texto.
          - Usar nombres no exactos (“chicha”, “lomo”) en \`item\`; mapea a los nombres del MENÚ.

        FORMATO DEL BLOQUE \`order\`
        ────────────────────────────────────────────────
        - JSON válido dentro de \`\`\`order …\`\`\`.
        - Puede ser un objeto o un array de objetos:
          {"op":"add"|"remove"|"clear"|"confirm"|"set","item":"<nombre exacto del MENÚ>","qty":<entero>}
        - \`item\` debe coincidir **exactamente** con un nombre del MENU.
        - \`qty\` es un entero >= 1 (salvo \`clear\` y \`confirm\` que no llevan \`qty\`).
        - **Un solo** bloque \`\`\`order\`\`\` por respuesta, siempre **al final**.

        REGLAS DE RECOMENDACIÓN (categoría correcta)
        ────────────────────────────────────────────────
        - “¿Qué me recomiendas para tomar/beber?” ⇒ sugiere 1–2 ítems de *Bebidas* y termina con una sola pregunta: “¿Agrego <ITEM>?”.
        - “¿Qué postre recomiendas?” ⇒ sugiere *Postres*.
        - “Quiero un fondo/entrada/plato fuerte” ⇒ sugiere *Fondos* o *Entradas*.
        - No agregues ítems de otra categoría al recomendar.

        CORRECCIONES AL INSTANTE (después de ejecutar un ítem)
        ──────────────────────────────────────────────────────
        Si el MENSAJE_ACTUAL dice algo como: “mejor solo N”, “déjalo en N”, “cámbialo a N”, “que sea N”, “solo 1”, “mejor 1”, sin nombrar el plato:

        Si el último cambio que TÚ ejecutaste fue sobre un único ítem X (tu último bloque order tenía 1 ítem) ⇒ interpreta eso como ajuste sobre X y EMITE:

        {"op":"set","item":"<X>","qty":N}

        En cualquier otro caso (no hay último ítem único, hubo varias opciones, o dudas) ⇒ NO uses pasado y pregunta:
        “¿A qué producto te refieres para dejarlo en N?” (sin order)

        Disparadores de set/remove (sin repetir el ítem)

        “mejor solo N”, “déjalo en N”, “cámbialo a N”, “ajústalo a N”, “que sea N”, “ponlo en N” ⇒ SET a N.

        “mejor ninguno”, “al final no”, “elimínalo”, “quítalo” ⇒ SET a 0 (o REMOVE equivalente).

        Consistencia obligatoria

        Si escribes “Listo, ajusté/quité…”, DEBES cerrar el mensaje con un único bloque order que refleje exactamente esa acción.

        Si no vas a incluir order, no uses pasado; formula una única pregunta.

        Ejemplos

        Antes:
        Tú: “¿Agrego Chicha Morada 500ml?”
        Cliente: “sí, agrega 2”
        →
        “Listo, agregué 2 Chicha Morada 500ml.”

        [{"op":"add","item":"Chicha Morada 500ml","qty":2}]


        Corrección inmediata:
        Cliente: “no, mejor solo 1”
        →
        “Listo, ajusté Chicha Morada 500ml a 1.”

        [{"op":"set","item":"Chicha Morada 500ml","qty":1}]


        Sin ancla única:
        Si no hay ‘último ítem único’ identificable
        → “¿A qué producto te refieres para dejarlo en 1?” (sin order)

        CART_SUMMARY (ajustes sobre lo existente)
        ────────────────────────────────────────────────
        - “deja en N <plato>” ⇒ \`set\` qty=N (si no existe ⇒ \`add\` qty=N).
        - “quita <plato>” / “ya no quiero <plato>” ⇒ \`set\` qty=0 (o \`remove\`).
        - “+1 <plato>”, “x2 <plato>” ⇒ \`add\` con esa cantidad.
        - No uses CART_SUMMARY para agregar platos que **no** se mencionaron claramente en el MENSAJE_ACTUAL.

        MAPEO A NOMBRES DEL MENÚ (sinónimos útiles)
        ────────────────────────────────────────────────
        - "aji"/"ají"/"aji de gallina" → "Aji de Gallina"
        - "lomo"/"lomo saltado"/"un lomo"/"el lomo" → "Lomo Saltado"
        - "papa huancaina"/"papas a la huancaina"/"huancaína"/"huancaina" → "Papa a la Huancaína"
        - "causa"/"causas" → "Causa Limeña"
        - "chicha"/"chicha morada" → "Chicha Morada 500ml"
        - "limonada" → "Limonada 500ml"

        CONSULTA DE MENÚ (sin \`order\`)
        ────────────────────────────────────────────────
        - Si piden ver el menú (“/menu”, “menú”, “qué hay hoy”, “ver menú”…): muestra TODO el MENU por categorías con precios y cierra con: “¿Te agrego alguno?”.

        EJEMPLOS (fijarse en que el \`order\` es solo el delta del MENSAJE_ACTUAL)
        ────────────────────────────────────────────────
        1) Carrito ya tiene Causa y Huancaína.
        MENSAJE_ACTUAL: "agrega 1 Lomo Saltado"
        → “Listo, agregué 1 Lomo Saltado.”
        \`\`\`order
        [{"op":"add","item":"Lomo Saltado","qty":1}]
        \`\`\`

        2) Confirmación a pregunta única previa:
        ASSISTANT_LAST: “¿Agrego Chicha Morada 500ml?”
        MENSAJE_ACTUAL: “sí, agrega 2”
        → “Listo, agregué 2 Chicha Morada 500ml.”
        \`\`\`order
        [{"op":"add","item":"Chicha Morada 500ml","qty":2}]
        \`\`\`

        3) Ambiguo (no ejecutar):
        ASSISTANT_LAST: “Te sugiero Chicha o Limonada.”
        MENSAJE_ACTUAL: “sí, agrega 2”
        → “¿A cuál te refieres, **Chicha Morada 500ml** o **Limonada 500ml**?” (sin \`order\`).
        `;

      const shortMenu = MENU.map(d => ({ id: d.id, name: d.name, price: d.price, category: d.category }));
      const cartSummary = Object.values(cart).map(it => ({
        id: it.dish.id, name: it.dish.name, qty: it.qty, unit_price: it.dish.price
      }));
      const lastAssistant = nextMessages.filter(m => m.role === "assistant").slice(-1)[0]?.content ?? "";

      let reply = await chatApi.send([
        { role: "system", content: SYSTEM_PROMPT },
        { role: "assistant", content: `MENU: ${JSON.stringify(shortMenu)}` },
        { role: "assistant", content: `CART_SUMMARY: ${JSON.stringify(cartSummary)}` },
        { role: "assistant", content: `ASSISTANT_LAST: ${lastAssistant}` },
        ...nextMessages,
      ]);

      // ===== Logging (opcional) =====
      const orderRaw = extractFence(reply, "order");
      const orderParsed = parseActions(orderRaw);
      const pendingRaw = extractFence(reply, "pending");
      const pendingParsed = parseActions(pendingRaw);
      console.log("RESPUESTA" , reply);
      console.log("LLM_ORDER_RAW:", orderRaw);
      console.log("LLM_ORDER_PARSED:", orderParsed);
      console.log("LLM_PENDING_RAW:", pendingRaw);
      console.log("LLM_PENDING_PARSED:", pendingParsed);

      // 1) Aplica SOLO `order` (si no hay bloque `order`, no cambia el carrito)
      setCart(prev => computeCartFromReply(reply, prev));

      // 2) Guarda `pending` (por si algún modelo lo usa, aunque está prohibido en el prompt)
      setPendingActions(pendingParsed.length ? pendingParsed : null);

      // 3) Texto limpio
      const cleanReply = stripInternalBlocks(reply);
      setMessages(prevMsgs => [...prevMsgs, { role: "assistant", content: cleanReply || "¿A qué producto te refieres?" }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Error al contactar al servicio." }]);
    } finally {
      setLoading(false);
    }
  }


  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  // ====== Panel de carrito ======
  function CartPanel() {
    const items = Object.values(cart);
    return (
      <div style={{ border: "1px solid #e5e7eb", background: "white", borderRadius: 12, padding: 12, marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <strong>🧺 Tu pedido</strong>
          <button
            onClick={() => setCart({})}
            disabled={items.length === 0}
            style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid #d1d5db", background: items.length ? "#fff" : "#f3f4f6", cursor: items.length ? "pointer" : "not-allowed" }}
          >
            Vaciar
          </button>
        </div>

        {items.length === 0 ? (
          <div style={{ color: "#6b7280" }}>Carrito vacío</div>
        ) : (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "56px 1fr 100px 110px", gap: 8, fontSize: 13, color: "#6b7280", padding: "4px 0" }}>
              <div style={{ textAlign: "center" }}>Cant.</div>
              <div>Producto</div>
              <div style={{ textAlign: "right" }}>Precio</div>
              <div style={{ textAlign: "right" }}>Subtotal</div>
            </div>
            {items.map(({ dish, qty }) => (
              <div key={dish.id} style={{ display: "grid", gridTemplateColumns: "56px 1fr 100px 110px", gap: 8, padding: "4px 0", borderTop: "1px dashed #e5e7eb" }}>
                <div style={{ textAlign: "center" }}>{qty}</div>
                <div>{dish.name}</div>
                <div style={{ textAlign: "right" }}>{currency(dish.price)}</div>
                <div style={{ textAlign: "right" }}>{currency(dish.price * qty)}</div>
              </div>
            ))}
            <div style={{ borderTop: "1px solid #e5e7eb", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
              <strong>Total a pagar</strong>
              <strong>{currency(total)}</strong>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <NavbarComponent />
      <div style={{ maxWidth: 800, margin: "32px auto", padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <h1 style={{ margin: 0 }}>Asistente de Pedidos (solo chat)</h1>
        </div>

        <CartPanel />

        <div
          ref={viewportRef}
          style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, height: 520, overflowY: "auto", background: "#fafafa" }}
        >
          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", margin: "8px 0" }}>
              <div style={{
                maxWidth: "85%", padding: "10px 12px", borderRadius: 12, whiteSpace: "pre-wrap",
                background: m.role === "user" ? "#2563eb" : "white", color: m.role === "user" ? "white" : "black",
                boxShadow: "0 1px 2px rgba(0,0,0,0.06)"
              }}>e
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
