/**
 * Chiamata minima all'API Chat Completions di OpenAI con fetch (nessuna dipendenza).
 * Il client è iniettabile: i test usano un client finto e non spendono nulla.
 */
export type ChatMessage =
  | { role: "system" | "user"; content: string | ContentPart[] }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } };

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ToolDef {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  tools?: ToolDef[];
  response_format?: Record<string, unknown>;
  max_tokens?: number;
  temperature?: number;
}

export interface ChatResponse {
  message: { content: string | null; tool_calls?: ToolCall[] };
  usage: { input: number; output: number };
}

export type ChatClient = (req: ChatRequest) => Promise<ChatResponse>;

export class AiError extends Error {
  constructor(message: string, readonly kind: "chiave" | "limite" | "servizio" | "tempo") {
    super(message);
  }
}

export function openAiClient(apiKey: string, timeoutMs = 45_000): ChatClient {
  return async (req) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(req),
        signal: controller.signal,
      });
      if (!res.ok) throw await describeError(res, req.model);
      const json = await res.json();
      const choice = json.choices?.[0]?.message ?? { content: "" };
      return {
        message: { content: choice.content ?? null, tool_calls: choice.tool_calls },
        usage: { input: json.usage?.prompt_tokens ?? 0, output: json.usage?.completion_tokens ?? 0 },
      };
    } catch (e) {
      if (e instanceof AiError) throw e;
      if (e instanceof Error && e.name === "AbortError") throw new AiError("Il coach ci sta mettendo troppo a rispondere. Riprova.", "tempo");
      throw new AiError("Non riesco a raggiungere il servizio AI. Controlla la connessione.", "servizio");
    } finally {
      clearTimeout(timer);
    }
  };
}

/** Traduce gli errori di OpenAI in messaggi chiari, senza mai riportare la chiave. */
async function describeError(res: Response, model: string): Promise<AiError> {
  let code = "";
  let detail = "";
  try {
    const j = await res.json();
    code = String(j?.error?.code ?? j?.error?.type ?? "");
    detail = String(j?.error?.message ?? "").replace(/sk-[A-Za-z0-9_-]+/g, "sk-***").slice(0, 200);
  } catch {
    /* corpo non JSON */
  }
  if (res.status === 401) return new AiError("OpenAI non accetta la chiave: è sbagliata, incompleta o è stata revocata. Ricreala su platform.openai.com e sostituiscila in .env.local.", "chiave");
  if (code === "insufficient_quota") return new AiError("Credito OpenAI esaurito o non ancora attivo. Aggiungi credito in Settings > Billing su platform.openai.com (può servire qualche minuto).", "limite");
  if (res.status === 429) return new AiError("Troppe richieste a OpenAI in poco tempo. Aspetta un minuto e riprova.", "limite");
  if (code === "model_not_found" || /model/i.test(detail) && res.status === 404) {
    return new AiError(`Il modello "${model}" non è disponibile nel tuo account OpenAI. Aggiungi in .env.local una riga OPENAI_MODEL= con un modello disponibile (per esempio gpt-4o-mini).`, "servizio");
  }
  if (res.status === 403) return new AiError(`OpenAI ha negato l'accesso (${detail || "progetto o modello non abilitato"}).`, "chiave");
  if (res.status === 400) return new AiError(`OpenAI ha rifiutato la richiesta: ${detail || "richiesta non valida"}.`, "servizio");
  return new AiError(`Il servizio AI non ha risposto correttamente (errore ${res.status}${detail ? `: ${detail}` : ""}).`, "servizio");
}
