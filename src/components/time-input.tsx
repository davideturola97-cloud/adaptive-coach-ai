"use client";

import { useState } from "react";

/**
 * Il tastierino numerico dell'iPhone non ha i due punti: si scrivono solo cifre e i ":" li mette l'app.
 * 4530 → 45:30 · 13900 → 1:39:00 · 013900 → 1:39:00. Chi scrive già i ":" (Android, computer) non cambia nulla.
 */
export function formatTimeInput(raw: string): string {
  if (raw.includes(":")) return raw.replace(/[^\d:]/g, "").slice(0, 8);
  const d = raw.replace(/\D/g, "").replace(/^0+(?=\d{5})/, "").slice(0, 6);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, -2)}:${d.slice(-2)}`;
  return `${Number(d.slice(0, -4))}:${d.slice(-4, -2)}:${d.slice(-2)}`;
}

/** Campo per un tempo (mm:ss o h:mm:ss) che funziona anche con il tastierino numerico dell'iPhone. */
export function TimeInput({ name, placeholder, defaultValue, className }: { name: string; placeholder?: string; defaultValue?: string; className?: string }) {
  const [v, setV] = useState(defaultValue ?? "");
  return <input name={name} inputMode="numeric" autoComplete="off" placeholder={placeholder} value={v} onChange={(e) => setV(formatTimeInput(e.target.value))} maxLength={8} className={className} />;
}
