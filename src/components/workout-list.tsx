"use client";

import clsx from "clsx";
import Link from "next/link";
import { useState } from "react";
import { SportDot, WorkoutRow } from "@/components/ui";
import { formatDayMonth, weekdayName } from "@/lib/dates";
import { SPORT_KEYS, SPORTS } from "@/lib/domain/sports";
import type { PlannedWorkout, Sport } from "@/lib/domain/types";
import { formatDuration } from "@/lib/training/formulas";

type Filter = "tutti" | Sport;
type When = "prossimi" | "passati";

export interface HistoryItem {
  key: string;
  date: string;
  sport: Sport;
  title: string;
  href: string;
  durationMin: number;
  rpe?: number;
  status: "fatta" | "extra" | "saltata" | "da registrare";
}

const STATUS_STYLE: Record<HistoryItem["status"], string> = {
  fatta: "text-ok",
  extra: "text-bike",
  saltata: "text-bad",
  "da registrare": "text-warn",
};

export function WorkoutList({ plan, today, history }: { plan: PlannedWorkout[]; today: string; history: HistoryItem[] }) {
  const [filter, setFilter] = useState<Filter>("tutti");
  const [when, setWhen] = useState<When>("prossimi");

  const sports = SPORT_KEYS.filter((s) => plan.some((p) => p.sport === s) || history.some((h) => h.sport === s));
  const upcoming = plan.filter((p) => p.date >= today && (filter === "tutti" || p.sport === filter));
  const past = history.filter((h) => filter === "tutti" || h.sport === filter);

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
        {([["tutti", "Tutti"], ...sports.map((s) => [s, SPORTS[s].label])] as [Filter, string][]).map(([f, label]) => (
          <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f} className={pill(filter === f)}>
            {label}
          </button>
        ))}
      </div>

      {when === "prossimi" ? (
        <div className="flex flex-col gap-2">
          {upcoming.map((w) => <WorkoutRow key={w.id} w={w} />)}
          {!upcoming.length && <p className="text-sm text-muted">Nessuna seduta in programma con questi filtri.</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {past.map((h) => (
            <Link key={h.key} href={h.href} className="flex min-h-16 items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 transition-colors hover:border-faint">
              <SportDot sport={h.sport} className="size-2.5" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{h.title}</p>
                <p className="truncate text-xs text-muted">
                  {weekdayName(h.date, true)} {formatDayMonth(h.date)} · {formatDuration(h.durationMin)}
                  {h.rpe ? ` · RPE ${h.rpe}` : ""}
                </p>
              </div>
              <span className={clsx("shrink-0 text-xs font-semibold", STATUS_STYLE[h.status])}>{h.status === "extra" ? "fuori programma" : h.status}</span>
            </Link>
          ))}
          {!past.length && <p className="text-sm text-muted">Ancora niente nello storico.</p>}
        </div>
      )}
    </div>
  );
}
