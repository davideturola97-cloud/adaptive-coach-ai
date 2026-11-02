"use client";

import clsx from "clsx";
import { ChevronLeft, ChevronRight, Flag } from "lucide-react";
import { useMemo, useState } from "react";
import { SportDot, SportLegend, WorkoutRow } from "@/components/ui";
import { SPORT_KEYS } from "@/lib/domain/sports";
import { addDays, formatDayMonth, mondayOf, monthTitle, weekdayName } from "@/lib/dates";
import type { PlannedWorkout, RaceEvent } from "@/lib/domain/types";
import { formatDuration } from "@/lib/training/formulas";

type Mode = "settimana" | "mese";

export function CalendarView({ plan, events, today }: { plan: PlannedWorkout[]; events: RaceEvent[]; today: string }) {
  const [mode, setMode] = useState<Mode>("settimana");
  const [anchor, setAnchor] = useState(today);
  const [selected, setSelected] = useState(today);

  const byDate = useMemo(() => {
    const m = new Map<string, PlannedWorkout[]>();
    for (const p of plan) m.set(p.date, [...(m.get(p.date) ?? []), p]);
    return m;
  }, [plan]);
  const eventOn = (d: string) => events.find((e) => e.date === d);

  const weekStart = mondayOf(anchor);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const monthStart = `${anchor.slice(0, 7)}-01`;
  const gridStart = mondayOf(monthStart);
  const gridDays = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  const move = (dir: 1 | -1) => {
    if (mode === "settimana") setAnchor(addDays(anchor, 7 * dir));
    else {
      const [y, m] = anchor.split("-").map(Number);
      const d = new Date(Date.UTC(y, m - 1 + dir, 1, 12));
      setAnchor(d.toISOString().slice(0, 10));
    }
  };

  const title = mode === "settimana" ? `${formatDayMonth(weekDays[0])} – ${formatDayMonth(weekDays[6])}` : monthTitle(anchor);
  const weekMin = weekDays.flatMap((d) => byDate.get(d) ?? []).reduce((t, p) => t + p.durationMin, 0);
  const selectedItems = byDate.get(selected) ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Vista" className="inline-flex rounded-xl border border-line bg-surface p-1">
          {(["settimana", "mese"] as Mode[]).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={clsx("min-h-10 rounded-lg px-4 text-sm font-semibold capitalize", mode === m ? "bg-surface-2 text-fg" : "text-muted")}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => move(-1)} aria-label="Precedente" className="grid size-11 place-items-center rounded-xl border border-line bg-surface hover:border-faint">
            <ChevronLeft className="size-5" />
          </button>
          <button onClick={() => { setAnchor(today); setSelected(today); }} className="min-h-11 rounded-xl border border-line bg-surface px-3 text-sm font-semibold hover:border-faint">
            Oggi
          </button>
          <button onClick={() => move(1)} aria-label="Successivo" className="grid size-11 place-items-center rounded-xl border border-line bg-surface hover:border-faint">
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>

      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        {mode === "settimana" && <span className="text-sm text-muted">{formatDuration(weekMin)} in programma</span>}
      </div>

      {mode === "settimana" ? (
        <ol className="flex flex-col gap-3">
          {weekDays.map((d) => {
            const items = byDate.get(d) ?? [];
            const ev = eventOn(d);
            return (
              <li key={d} className="grid grid-cols-[3.25rem_1fr] gap-3">
                <div className={clsx("flex flex-col items-center rounded-xl py-2", d === today ? "bg-fg text-bg" : "text-muted")}>
                  <span className="text-[11px] font-semibold uppercase">{weekdayName(d, true)}</span>
                  <span className="num text-2xl font-semibold leading-none">{Number(d.slice(8))}</span>
                </div>
                <div className="flex min-w-0 flex-col gap-2">
                  {ev && (
                    <p className="flex items-center gap-2 rounded-2xl border border-run/40 bg-run-soft px-4 py-3 text-sm font-semibold text-run">
                      <Flag className="size-4" aria-hidden /> {ev.name}
                    </p>
                  )}
                  {items.length ? items.map((w) => <WorkoutRow key={w.id} w={w} showDate={false} />) : (
                    !ev && <p className="flex min-h-14 items-center rounded-2xl border border-dashed border-line px-4 text-sm text-faint">Riposo</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-faint">
            {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((d) => <span key={d}>{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {gridDays.map((d) => {
              const items = byDate.get(d) ?? [];
              const out = d.slice(0, 7) !== anchor.slice(0, 7);
              const ev = eventOn(d);
              return (
                <button
                  key={d}
                  onClick={() => setSelected(d)}
                  aria-pressed={selected === d}
                  aria-label={`${weekdayName(d)} ${formatDayMonth(d, false)}: ${items.length ? items.map((p) => p.title).join(", ") : "riposo"}`}
                  className={clsx(
                    "flex aspect-square min-h-11 flex-col items-center justify-start gap-1 rounded-lg border p-1 pt-1.5 sm:aspect-[4/3]",
                    selected === d ? "border-fg/70 bg-surface-2" : "border-line bg-surface",
                    out && "opacity-35",
                    ev && "border-run/60",
                  )}
                >
                  <span className={clsx("num text-sm leading-none", d === today && "rounded-full bg-fg px-1.5 py-0.5 text-bg")}>{Number(d.slice(8))}</span>
                  <span className="flex flex-wrap justify-center gap-0.5">
                    {items.map((p) => (
                      <SportDot key={p.id} sport={p.sport} className="size-1.5 sm:size-2" faded={p.status === "saltato"} />
                    ))}
                    {ev && <Flag className="size-3 text-run" aria-hidden />}
                  </span>
                </button>
              );
            })}
          </div>
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-muted">{weekdayName(selected)} {formatDayMonth(selected, false)}</h3>
            {eventOn(selected) && <p className="rounded-2xl border border-run/40 bg-run-soft px-4 py-3 text-sm font-semibold text-run">{eventOn(selected)!.name}</p>}
            {selectedItems.length ? selectedItems.map((w) => <WorkoutRow key={w.id} w={w} showDate={false} />) : <p className="text-sm text-faint">Riposo</p>}
          </section>
        </>
      )}

      <SportLegend sports={SPORT_KEYS.filter((s) => plan.some((p) => p.sport === s))} />
    </div>
  );
}
