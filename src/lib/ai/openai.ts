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
      if (res.status === 401) throw new AiError("La chiave OpenAI non è valida o è stata revocata.", "chiave");
      if (res.status === 429) throw new AiError("OpenAI ha rifiutato la richiesta per limiti di uso o credito esaurito.", "limite");
      if (!res.ok) throw new AiError(`Il servizio AI non ha risposto correttamente (errore ${res.status}).`, "servizio");
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
