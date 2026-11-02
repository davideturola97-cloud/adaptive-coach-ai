/** Controllo dei limiti giornalieri di uso dell'AI (costi sotto controllo). */
export interface Usage {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  images: number;
}

export function limitMessage(u: Usage, limits: { requests: number; tokens: number; images: number }, wantsImage = false): string | null {
  if (u.requests >= limits.requests) return `Hai raggiunto il limite di ${limits.requests} richieste al coach per oggi. Riprova domani.`;
  if (u.inputTokens + u.outputTokens >= limits.tokens) return "Hai raggiunto il limite di uso giornaliero del coach. Riprova domani.";
  if (wantsImage && u.images >= limits.images) return `Hai raggiunto il limite di ${limits.images} screenshot al giorno. Riprova domani o inserisci l'attività a mano.`;
  return null;
}
