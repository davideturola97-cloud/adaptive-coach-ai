"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { GymDay } from "@/lib/domain/types";
import { DAYS, MUSCLE_GROUPS } from "@/lib/training/gym-schedule";
import { saveGymSchedule, type GymState } from "./actions";

const FULL: Record<string, string> = { Lun: "Lunedì", Mar: "Martedì", Mer: "Mercoledì", Gio: "Giovedì", Ven: "Venerdì", Sab: "Sabato", Dom: "Domenica" };

export function GymForm({ schedule, demo }: { schedule: GymDay[]; demo: boolean }) {
  const [state, action, pending] = useActionState<GymState, FormData>(saveGymSchedule, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      {DAYS.map((day) => {
        const cur = schedule.find((g) => g.day === day);
        return (
          <details key={day} open={Boolean(cur)} className="group rounded-2xl border border-line bg-surface p-3">
            <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-3">
              <span className="font-semibold">{FULL[day]}</span>
              <span className="truncate text-sm text-muted group-open:hidden">{cur ? cur.groups.join(", ") : "nessuna palestra · tocca per aggiungere"}</span>
            </summary>
            <fieldset className="mt-2 flex flex-col gap-2">
            <legend className="sr-only">{FULL[day]}</legend>
            <div className="flex items-center justify-end gap-3">
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
            </fieldset>
          </details>
        );
      })}
      <p className="text-xs text-muted">Apri un giorno per scegliere i gruppi muscolari. Per togliere un giorno deseleziona tutto e salva.</p>
      {state.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      {state.saved && (
        <p role="status" className="text-sm text-ok">
          Scheda salvata: i consigli qui sotto sono aggiornati. Per mettere la palestra nel calendario e spostare le sedute chiave lontano dalle gambe,{" "}
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
