"use client";

import { useState } from "react";

/**
 * Scelta di un tempo con tre quadratini: ore, minuti, secondi. Su iPhone e Android diventano le rotelle di sistema:
 * niente tastiera e niente due punti da scrivere. Il valore inviato è "h:mm:ss" (o "mm:ss" senza ore).
 */
export function toParts(v?: string): { h: number; m: number; s: number } {
  const n = (v ?? "").split(":").map((x) => Number(x) || 0);
  if (n.length === 3) return { h: n[0], m: n[1], s: n[2] };
  if (n.length === 2) return { h: 0, m: n[0], s: n[1] };
  return { h: 0, m: 0, s: 0 };
}

export function fromParts({ h, m, s }: { h: number; m: number; s: number }, withHours: boolean): string {
  if (!h && !m && !s) return "";
  const ss = String(s).padStart(2, "0");
  return withHours && h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m + h * 60}:${ss}`;
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const box = "min-h-12 rounded-xl border border-line bg-bg px-2 text-lg tabular-nums text-fg outline-none focus:border-faint";

/** Tre quadratini (ore facoltative). Controllato con value/onChange, oppure con name per i moduli. */
export function TimePicker({
  name,
  value,
  defaultValue,
  onChange,
  hours = true,
  maxHours = 9,
  label,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
  hours?: boolean;
  maxHours?: number;
  label?: string;
}) {
  const [inner, setInner] = useState(toParts(defaultValue));
  const parts = value !== undefined ? toParts(value) : inner;
  const set = (k: "h" | "m" | "s", n: number) => {
    const next = { ...parts, [k]: n };
    if (value === undefined) setInner(next);
    onChange?.(fromParts(next, hours));
  };
  const sel = (k: "h" | "m" | "s", n: number, aria: string) => (
    <label className="flex flex-col items-center gap-1 text-xs text-muted">
      <select aria-label={label ? `${label}: ${aria}` : aria} value={parts[k]} onChange={(e) => set(k, Number(e.target.value))} className={box}>
        {range(k === "h" ? maxHours + 1 : 60).map((i) => (
          <option key={i} value={i}>{k === "h" ? i : String(i).padStart(2, "0")}</option>
        ))}
      </select>
      {aria}
    </label>
  );
  return (
    <div className="flex items-start gap-1.5">
      {name && <input type="hidden" name={name} value={fromParts(parts, hours)} />}
      {hours && (
        <>
          {sel("h", parts.h, "ore")}
          <span className="pt-3 text-lg text-muted">:</span>
        </>
      )}
      {sel("m", parts.m, "minuti")}
      <span className="pt-3 text-lg text-muted">:</span>
      {sel("s", parts.s, "secondi")}
    </div>
  );
}

/** Compatibilità con i moduli dei test: stesso nome, ora con i quadratini (ore solo se il segnaposto le prevede). */
export function TimeInput({ name, placeholder, defaultValue }: { name: string; placeholder?: string; defaultValue?: string; className?: string }) {
  const withHours = (placeholder ?? "").split(":").length === 3;
  return <TimePicker name={name} defaultValue={defaultValue} hours={withHours} maxHours={withHours ? 9 : 0} />;
}
