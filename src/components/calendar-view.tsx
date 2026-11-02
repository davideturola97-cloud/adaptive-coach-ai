"use client";

import clsx from "clsx";
import { ChevronLeft, ChevronRight, Flag, Timer } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { SportDot, SportLegend, WorkoutRow } from "@/components/ui";
import { SPORT_KEYS } from "@/lib/domain/sports";
import { addDays, formatDayMonth, mondayOf, monthTitle, weekdayName } from "@/lib/dates";
import type { PlannedTest, PlannedWorkout, RaceEvent } from "@/lib/domain/types";
import { eventDescription } from "@/components/event-summary";
import { TEST_CATALOG } from "@/lib/training/tests";
import { formatDuration } from "@/lib/training/formulas";

type Mode = "settimana" | "mese";

/** Gare e test di un giorno: compaiono sopra gli allenamenti. */
function DayExtras({ events, tests }: { events: RaceEvent[]; tests: PlannedTest[] }) {
  return (
    <>
      {events.map((ev) => (
        <Link key={ev.id} href="/profilo/gare" className="flex items-start gap-2 rounded-2xl border border-run/40 bg-run-soft px-4 py-3 text-sm text-run">
          <Flag className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="min-w-0">
            <span className="block font-semibold">{ev.name} <span className="font-normal opacity-80">· gara {ev.priority}</span></span>
            <span className="block text-xs opacity-80">{eventDescription(ev)}</span>
          </span>
        </Link>
      ))}
      {tests.map((t) => (
        <Link key={t.id} href="/test" className="flex items-center gap-2 rounded-2xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm font-semibold text-warn">
          <Timer className="size-4 shrink-0" aria-hidden />
          <span className="min-w-0">
            {TEST_CATALOG[t.kind].label} <span className="font-normal opacity-80">· {t.status === "programmato" ? "programmato" : "da riproporre"}</span>
          </span>
        </Link>
      ))}
    </>
  );
}

export function CalendarView({ plan, events, today, tests = [] }: { plan: PlannedWorkout[]; events: RaceEvent[]; today: string; tests?: PlannedTest[] }) {
  const [mode, setMode] = useState<Mode>("settimana");
  const [anchor, setAnchor] = useState(today);
  const [selected, setSelected] = useState(today);

  const byDate = useMemo(() => {
    const m = new Map<string, PlannedWorkout[]>();
    for (const p of plan) m.set(p.date, [...(m.get(p.date) ?? []), p]);
    return m;
  }, [plan]);
  const eventsOn = (d: string) => events.filter((e) => e.date === d);
  const testsOn = (d: string) => tests.filter((t) => t.dueDate === d && (t.status === "programmato" || t.status === "rimandato"));
  const upcoming = [
    ...events.filter((e) => e.date >= today).map((e) => ({ date: e.date, label: e.name, kind: "gara" as const })),
    ...tests.filter((t) => t.dueDate && t.dueDate >= today && (t.status === "programmato" || t.status === "rimandato")).map((t) => ({ date: t.dueDate!, label: TEST_CATALOG[t.kind].label, kind: "test" as const })),
  ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);

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
      {upcoming.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {upcoming.map((u) => (
            <button
              key={`${u.kind}-${u.date}-${u.label}`}
              onClick={() => { setAnchor(u.date); setSelected(u.date); }}
              className={clsx("flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold", u.kind === "gara" ? "border-run/40 text-run" : "border-warn/40 text-warn")}
            >
              {u.kind === "gara" ? <Flag className="size-3.5" aria-hidden /> : <Timer className="size-3.5" aria-hidden />}
              {u.label} · {formatDayMonth(u.date)}
            </button>
          ))}
        </div>
      )}
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
            const evs = eventsOn(d);
            const tst = testsOn(d);
            return (
              <li key={d} className="grid grid-cols-[3.25rem_1fr] gap-3">
                <div className={clsx("flex flex-col items-center rounded-xl py-2", d === today ? "bg-fg text-bg" : "text-muted")}>
                  <span className="text-[11px] font-semibold uppercase">{weekdayName(d, true)}</span>
                  <span className="num text-2xl font-semibold leading-none">{Number(d.slice(8))}</span>
                </div>
                <div className="flex min-w-0 flex-col gap-2">
                  <DayExtras events={evs} tests={tst} />
                  {items.length ? items.map((w) => <WorkoutRow key={w.id} w={w} showDate={false} />) : (
                    !evs.length && !tst.length && <p className="flex min-h-14 items-center rounded-2xl border border-dashed border-line px-4 text-sm text-faint">Riposo</p>
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
              const ev = eventsOn(d).length > 0;
              const tst = testsOn(d).length > 0;
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
                    {tst && <Timer className="size-3 text-warn" aria-hidden />}
                  </span>
                </button>
              );
            })}
          </div>
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-muted">{weekdayName(selected)} {formatDayMonth(selected, false)}</h3>
            <DayExtras events={eventsOn(selected)} tests={testsOn(selected)} />
            {selectedItems.length ? selectedItems.map((w) => <WorkoutRow key={w.id} w={w} showDate={false} />) : !eventsOn(selected).length && !testsOn(selected).length && <p className="text-sm text-faint">Riposo</p>}
          </section>
        </>
      )}

      <SportLegend sports={SPORT_KEYS.filter((s) => plan.some((p) => p.sport === s))} />
    </div>
  );
}
