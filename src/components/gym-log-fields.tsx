"use client";

import { useState } from "react";
import type { GymExercise } from "@/lib/domain/types";

export interface GymLogDefault {
  exercise: GymExercise;
  /** Carico consigliato dal coach per oggi. */
  suggestKg?: number;
  hint?: string;
}

const cell = "min-h-10 w-full rounded-lg border border-line bg-bg px-2 text-base text-fg outline-none focus:border-faint";

/** Carichi e ripetizioni fatti, esercizio per esercizio. Già compilati: si cambia solo quello che è andato diversamente. */
export function GymLogFields({ items }: { items: GymLogDefault[] }) {
  const [rows, setRows] = useState(
    items.map((i) => ({
      name: i.exercise.name,
      sets: String(i.exercise.sets),
      reps: i.exercise.reps,
      loadKg: i.suggestKg !== undefined ? String(i.suggestKg).replace(".", ",") : i.exercise.loadKg !== undefined ? String(i.exercise.loadKg).replace(".", ",") : "",
      done: true,
    })),
  );
  const set = (k: number, f: "sets" | "reps" | "loadKg", v: string) => setRows((r) => r.map((x, j) => (j === k ? { ...x, [f]: v } : x)));
  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name="gymLog" value={JSON.stringify(rows.map((r) => ({ ...r, loadKg: r.loadKg.replace(",", ".") })))} />
      <p className="text-sm font-medium">Esercizi <span className="text-xs font-normal text-muted">(già compilati: cambia solo quello che è andato diversamente)</span></p>
      {rows.map((r, k) => (
        <div key={r.name + k} className="flex flex-col gap-1.5 rounded-xl border border-line p-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">{r.name}</span>
            <label className="flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" checked={r.done} onChange={(e) => setRows((x) => x.map((y, j) => (j === k ? { ...y, done: e.target.checked } : y)))} className="size-5 accent-ok" />
              tutte le serie riuscite
            </label>
          </div>
          {items[k].hint && <p className="text-xs text-warn">{items[k].hint}</p>}
          <div className="grid grid-cols-3 gap-1.5 text-[11px] text-muted">
            <label className="flex flex-col gap-0.5">Serie<input inputMode="numeric" value={r.sets} onChange={(e) => set(k, "sets", e.target.value)} className={cell} /></label>
            <label className="flex flex-col gap-0.5">Ripetizioni<input value={r.reps} onChange={(e) => set(k, "reps", e.target.value)} className={cell} /></label>
            <label className="flex flex-col gap-0.5">Kg<input inputMode="decimal" value={r.loadKg} placeholder="–" onChange={(e) => set(k, "loadKg", e.target.value)} className={cell} /></label>
          </div>
        </div>
      ))}
    </div>
  );
}
