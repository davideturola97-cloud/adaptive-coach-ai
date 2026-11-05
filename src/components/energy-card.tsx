"use client";

import clsx from "clsx";
import { Flame } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { setDailySteps } from "@/app/oggi/actions";
import type { EnergyDay } from "@/lib/training/energy";

const TYPE: Record<EnergyDay["dayType"], string> = {
  riposo: "Giorno di riposo", leggera: "Giornata leggera", moderata: "Giornata moderata", intensa: "Giornata intensa", "pre-gara": "Vigilia di gara", gara: "Giorno di gara",
};
const STEPS = Array.from({ length: 26 }, (_, i) => i * 1000);

/** Calorie di mantenimento della giornata e ripartizione: stima, con il dettaglio del calcolo a richiesta. */
export interface EnergyNext {
  date: string;
  label: string;
  day: EnergyDay;
}

export function EnergyCard({ day, steps, demo, next = [] }: { day: EnergyDay | null; steps?: number; demo: boolean; next?: EnergyNext[] }) {
  const [pending, start] = useTransition();
  if (!day) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold"><Flame className="size-4 text-warn" aria-hidden /> Energia di oggi</p>
        <p className="text-muted">Per stimare le calorie di mantenimento servono peso, altezza, data di nascita e sesso.</p>
        <Link href="/profilo/modifica" className="self-start font-semibold underline">Completa il profilo</Link>
      </div>
    );
  }
  const kcal = (n: number) => `${n.toLocaleString("it-IT")} kcal`;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted"><Flame className="size-4 text-warn" aria-hidden /> Energia di oggi · stima</p>
          <p className="num mt-1 text-4xl font-semibold">{day.total.toLocaleString("it-IT")}<span className="text-base text-muted"> kcal</span></p>
          <p className="text-sm text-muted">{TYPE[day.dayType]} · mantenimento</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { k: "Carboidrati", g: day.carbsG, c: "text-warn" },
          { k: "Proteine", g: day.proteinG, c: "text-run" },
          { k: "Grassi", g: day.fatG, c: "text-swim" },
        ].map((m) => (
          <div key={m.k} className="rounded-xl bg-surface-2 p-2">
            <p className={clsx("num text-2xl font-semibold", m.c)}>{m.g}<span className="text-sm"> g</span></p>
            <p className="text-xs text-muted">{m.k}</p>
          </div>
        ))}
      </div>
      {day.notes.length > 0 && <ul className="flex flex-col gap-1 text-sm text-muted">{day.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
      <label className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-muted">Passi medi al giorno <span className="text-xs">(senza la corsa)</span></span>
        <select
          aria-label="Passi medi al giorno"
          value={steps ?? ""}
          disabled={pending || demo}
          onChange={(e) => start(async () => { await setDailySteps(Number(e.target.value)); })}
          className="min-h-11 rounded-xl border border-line bg-bg px-3 text-base tabular-nums text-fg disabled:opacity-60"
        >
          {steps === undefined && <option value="">scegli</option>}
          {STEPS.map((n) => <option key={n} value={n}>{n === 25000 ? "25.000 o più" : n.toLocaleString("it-IT")}</option>)}
        </select>
      </label>
      {next.length > 0 && (
        <details className="text-sm" open>
          <summary className="min-h-9 cursor-pointer font-semibold text-muted">Prossimi giorni</summary>
          <ul className="mt-1 flex flex-col">
            {next.map((n) => (
              <li key={n.date} className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-0">
                <span className="min-w-0">
                  <span className="font-medium">{n.label}</span>
                  <span className={clsx("block text-xs", n.day.dayType === "pre-gara" || n.day.dayType === "gara" ? "text-run" : n.day.dayType === "intensa" ? "text-warn" : "text-muted")}>
                    {TYPE[n.day.dayType]}{n.day.sessions.length ? ` · ${n.day.sessions.map((s) => s.title).join(", ")}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="num block text-lg font-semibold">{n.day.total.toLocaleString("it-IT")}<span className="text-xs text-muted"> kcal</span></span>
                  <span className="block text-xs text-muted">C {n.day.carbsG} · P {n.day.proteinG} · G {n.day.fatG} g</span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <details className="text-sm">
        <summary className="min-h-9 cursor-pointer font-semibold text-muted">Come è calcolato</summary>
        <ul className="mt-2 flex flex-col gap-1 text-muted">
          <li>Metabolismo a riposo: {kcal(day.bmr)} (formula di Mifflin-St Jeor)</li>
          <li>Con la vita quotidiana ({steps !== undefined ? `${steps.toLocaleString("it-IT")} passi al giorno` : "passi non indicati"}): {kcal(day.daily)}</li>
          <li>Allenamento: +{kcal(day.training)}{day.sessions.length ? ` (${day.sessions.map((s) => `${s.title} ${s.kcal} kcal${s.done ? "" : ", da fare"}`).join("; ")})` : ""}</li>
          <li>Proteine 1,6–1,8 g/kg; carboidrati secondo il carico della giornata; grassi il resto (almeno 0,8 g/kg).</li>
        </ul>
        <p className="mt-2 text-xs text-faint">Stima con un margine del 10–15%: serve a orientarsi. Non è un consiglio medico o dietetico; con obiettivi di peso o problemi di salute rivolgiti a un professionista.</p>
      </details>
    </div>
  );
}
