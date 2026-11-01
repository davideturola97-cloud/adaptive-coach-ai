"use client";

import clsx from "clsx";
import { useState } from "react";
import { WorkoutRow } from "@/components/ui";
import type { PlannedWorkout, Sport } from "@/lib/domain/types";

type Filter = "tutti" | Sport;
type When = "prossimi" | "passati";

export function WorkoutList({ plan, today }: { plan: PlannedWorkout[]; today: string }) {
  const [filter, setFilter] = useState<Filter>("tutti");
  const [when, setWhen] = useState<When>("prossimi");

  const items = plan
    .filter((p) => (filter === "tutti" ? true : p.sport === filter))
    .filter((p) => (when === "prossimi" ? p.date >= today : p.date < today));
  const ordered = when === "prossimi" ? items : [...items].reverse();

  const pill = (active: boolean) =>
    clsx("min-h-10 rounded-full border px-4 text-sm font-semibold", active ? "border-fg bg-fg text-bg" : "border-line bg-surface text-muted hover:text-fg");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {(["prossimi", "passati"] as When[]).map((w) => (
          <button key={w} onClick={() => setWhen(w)} aria-pressed={when === w} className={pill(when === w)}>
            {w === "prossimi" ? "In programma" : "Storico"}
          </button>
        ))}
        <span className="mx-1 w-px bg-line" aria-hidden />
        {([["tutti", "Tutti"], ["run", "Corsa"], ["bike", "Ciclismo"]] as [Filter, string][]).map(([f, label]) => (
          <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f} className={pill(filter === f)}>
            {label}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {ordered.map((w) => <WorkoutRow key={w.id} w={w} />)}
        {!ordered.length && <p className="text-sm text-muted">Nessun allenamento con questi filtri.</p>}
      </div>
    </div>
  );
}
