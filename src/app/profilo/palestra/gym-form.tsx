"use client";

import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import type { GymDay } from "@/lib/domain/types";
import { DAYS, EXERCISE_SUGGESTIONS, MUSCLE_GROUPS } from "@/lib/training/gym-schedule";
import { saveGymSchedule, type GymState } from "./actions";

const FULL: Record<string, string> = { Lun: "Lunedì", Mar: "Martedì", Mer: "Mercoledì", Gio: "Giovedì", Ven: "Venerdì", Sab: "Sabato", Dom: "Domenica" };
const RESTS = [0, 30, 45, 60, 90, 120, 150, 180, 240];
const restLabel = (s: number) => (!s ? "–" : s < 60 ? `${s}″` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);

type Row = { name: string; sets: string; reps: string; loadKg: string; restSec: string };
const toRows = (g?: GymDay): Row[] =>
  (g?.exercises ?? []).map((e) => ({ name: e.name, sets: String(e.sets), reps: e.reps, loadKg: e.loadKg !== undefined ? String(e.loadKg).replace(".", ",") : "", restSec: String(e.restSec ?? 90) }));
const empty = (): Row => ({ name: "", sets: "3", reps: "10", loadKg: "", restSec: "90" });
const cell = "min-h-10 w-full rounded-lg border border-line bg-bg px-2 text-base text-fg outline-none focus:border-faint";

function Exercises({ day, initial }: { day: string; initial: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initial);
  const set = (i: number, k: keyof Row, v: string) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={`ex_${day}`} value={JSON.stringify(rows)} />
      {rows.map((r, i) => (
        <div key={i} className="flex flex-col gap-1.5 rounded-xl border border-line p-2">
          <div className="flex items-center gap-2">
            <input aria-label="Esercizio" list="esercizi" placeholder="Esercizio (es. Squat)" value={r.name} maxLength={60} onChange={(e) => set(i, "name", e.target.value)} className={cell} />
            <button type="button" aria-label={`Togli ${r.name || "esercizio"}`} onClick={() => setRows((x) => x.filter((_, j) => j !== i))} className="grid size-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-bad/10 hover:text-bad">
              <Trash2 className="size-4" aria-hidden />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1.5 text-[11px] text-muted">
            <label className="flex flex-col gap-0.5">Serie<input inputMode="numeric" value={r.sets} onChange={(e) => set(i, "sets", e.target.value)} className={cell} /></label>
            <label className="flex flex-col gap-0.5">Ripetiz.<input value={r.reps} placeholder="8-10" onChange={(e) => set(i, "reps", e.target.value)} className={cell} /></label>
            <label className="flex flex-col gap-0.5">Kg<input inputMode="decimal" value={r.loadKg} placeholder="–" onChange={(e) => set(i, "loadKg", e.target.value)} className={cell} /></label>
            <label className="flex flex-col gap-0.5">Recupero
              <select value={r.restSec} onChange={(e) => set(i, "restSec", e.target.value)} className={cell}>
                {RESTS.map((s) => <option key={s} value={s}>{restLabel(s)}</option>)}
              </select>
            </label>
          </div>
        </div>
      ))}
      {rows.length < 15 && (
        <button type="button" onClick={() => setRows((r) => [...r, empty()])} className="inline-flex min-h-10 items-center gap-2 self-start rounded-lg border border-dashed border-faint px-3 text-sm font-semibold text-muted hover:text-fg">
          <Plus className="size-4" aria-hidden /> Aggiungi esercizio
        </button>
      )}
    </div>
  );
}

export function GymForm({ schedule, demo }: { schedule: GymDay[]; demo: boolean }) {
  const [state, action, pending] = useActionState<GymState, FormData>(saveGymSchedule, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <datalist id="esercizi">{EXERCISE_SUGGESTIONS.map((e) => <option key={e} value={e} />)}</datalist>
      {DAYS.map((day) => {
        const cur = schedule.find((g) => g.day === day);
        const summary = cur ? [cur.groups.join(", "), cur.exercises?.length ? `${cur.exercises.length} esercizi` : ""].filter(Boolean).join(" · ") : "nessuna palestra · tocca per aggiungere";
        return (
          <details key={day} open={Boolean(cur)} className="group rounded-2xl border border-line bg-surface p-3">
            <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-3">
              <span className="font-semibold">{FULL[day]}</span>
              <span className="truncate text-sm text-muted group-open:hidden">{summary}</span>
            </summary>
            <fieldset className="mt-2 flex flex-col gap-3">
              <legend className="sr-only">{FULL[day]}</legend>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">Gruppi muscolari</span>
                <label className="flex items-center gap-2 text-xs text-muted">
                  Durata
                  <select name={`d_${day}`} defaultValue={cur?.durationMin ?? 60} className="min-h-9 rounded-lg border border-line bg-bg px-2 text-sm text-fg">
                    {[30, 45, 60, 75, 90].map((m) => <option key={m} value={m}>{m}&apos;</option>)}
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {MUSCLE_GROUPS.map((m) => (
                  <label key={m.key} className="cursor-pointer">
                    <input type="checkbox" name={`g_${day}`} value={m.key} defaultChecked={cur?.groups.includes(m.key)} className="peer sr-only" />
                    <span className="flex min-h-9 items-center rounded-lg border border-line px-3 text-sm text-muted peer-checked:border-gym peer-checked:bg-gym-soft peer-checked:text-gym peer-focus-visible:outline peer-focus-visible:outline-2">
                      {m.key}
                    </span>
                  </label>
                ))}
              </div>
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Esercizi</span>
              <Exercises day={day} initial={toRows(cur)} />
            </fieldset>
          </details>
        );
      })}
      <p className="text-xs text-muted">Apri un giorno per scegliere gruppi ed esercizi. Ripetizioni: un numero (8), un intervallo (8-10), un tempo (30″) o max. Per togliere un giorno svuotalo e salva.</p>
      {state.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      {state.saved && (
        <p role="status" className="text-sm text-ok">
          Scheda salvata: i consigli qui sopra sono aggiornati. Per mettere la palestra nel calendario e spostare le sedute chiave lontano dalle gambe,{" "}
          <Link href="/programma" className="font-semibold underline">rigenera il programma</Link>.
        </p>
      )}
      <button disabled={pending || demo} className="sticky bottom-20 min-h-12 rounded-xl bg-ok text-base font-semibold text-bg shadow-lg shadow-black/40 disabled:opacity-50 md:bottom-4">
        {pending ? "Salvataggio..." : "Salva la scheda"}
      </button>
      {demo && <p className="text-sm text-muted">In modalità dimostrativa non si salva.</p>}
    </form>
  );
}
