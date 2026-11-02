/**
 * Configurazione dell'AI, letta solo sul server. La chiave non ha il prefisso NEXT_PUBLIC_:
 * Next.js non la include mai nel codice inviato al browser.
 */
export interface AiConfig {
  apiKey: string;
  model: string;
  visionModel: string;
  limits: { requests: number; tokens: number; images: number };
}

const int = (v: string | undefined, d: number) => (v && /^\d+$/.test(v) ? Number(v) : d);

export function aiConfig(): AiConfig | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
  return {
    apiKey,
    model,
    visionModel: process.env.OPENAI_VISION_MODEL?.trim() || model,
    limits: {
      requests: int(process.env.AI_DAILY_REQUESTS, 60),
      tokens: int(process.env.AI_DAILY_TOKENS, 300_000),
      images: int(process.env.AI_DAILY_IMAGES, 15),
    },
  };
}

export const isAiConfigured = () => aiConfig() !== null;
