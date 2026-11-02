"use client";

import clsx from "clsx";
import { useActionState, useState } from "react";
import { logActivity, skipWorkout, type LogState, type SkipState } from "@/app/allenamenti/actions";
import { FEELINGS } from "@/lib/domain/activity-schema";
import { SPORT_KEYS, SPORTS } from "@/lib/domain/sports";
import type { Sport } from "@/lib/domain/types";
import { Field, inputCls } from "./form";

const RPE_HINT: Record<number, string> = {
  1: "Riposo", 2: "Molto facile", 3: "Facile", 4: "Comodo", 5: "Moderato",
  6: "Impegnativo", 7: "Duro", 8: "Molto duro", 9: "Quasi al massimo", 10: "Massimo",
};

/** Riga di pulsanti numerati (RPE, fatica, sonno): grandi, facili da toccare. */
function Scale({ name, max, label, hint, optional, defaultValue }: { name: string; max: number; label: string; hint?: (n: number) => string; optional?: boolean; defaultValue?: number }) {
  const [v, setV] = useState<number | undefined>(defaultValue);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">
        {label} {optional && <span className="text-xs font-normal text-muted">(facoltativo)</span>}
      </legend>
      <div className={clsx("grid gap-1.5", max === 10 ? "grid-cols-5 sm:grid-cols-10" : "grid-cols-5")}>
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <label key={n} className="cursor-pointer">
            <input type="radio" name={name} value={n} checked={v === n} onChange={() => setV(n)} className="peer sr-only" />
            <span className="flex min-h-12 items-center justify-center rounded-xl border border-line text-base font-semibold text-muted peer-checked:border-fg peer-checked:bg-fg peer-checked:text-bg peer-focus-visible:outline peer-focus-visible:outline-2">
              {n}
            </span>
          </label>
        ))}
      </div>
      {hint && <p className="min-h-4 text-xs text-muted">{v ? hint(v) : " "}</p>}
    </fieldset>
  );
}

export function FeedbackFields() {
  return (
    <div className="flex flex-col gap-5">
      <Scale name="rpe" max={10} label="Quanto è stata dura? (RPE 1–10)" hint={(n) => RPE_HINT[n]} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Scale name="muscleFatigue" max={5} label="Fatica muscolare" hint={(n) => ["", "Nessuna", "Leggera", "Media", "Alta", "Molto alta"][n]} />
        <Scale name="cardioFatigue" max={5} label="Fatica di fiato e cuore" hint={(n) => ["", "Nessuna", "Leggera", "Media", "Alta", "Molto alta"][n]} />
      </div>
      <Scale name="sleepQuality" max={5} label="Come hai dormito la notte prima?" optional hint={(n) => ["", "Malissimo", "Male", "Così così", "Bene", "Benissimo"][n]} />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Come ti sei sentito?</legend>
        <div className="flex flex-wrap gap-2">
          {FEELINGS.map((f) => (
            <label key={f} className="cursor-pointer">
              <input type="radio" name="feeling" value={f} className="peer sr-only" />
              <span className="flex min-h-11 items-center rounded-xl border border-line px-4 text-sm font-semibold capitalize text-muted peer-checked:border-fg peer-checked:bg-fg peer-checked:text-bg">{f}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Dolori o fastidi" hint="Facoltativo. Dove e quanto, per esempio: polpaccio destro, leggero.">
        <input name="pain" maxLength={500} className={inputCls} />
      </Field>
      <Field label="Note per il coach" hint="Facoltativo. Tutto quello che vuoi dire su questa seduta.">
        <textarea name="notes" rows={3} maxLength={2000} className={`${inputCls} py-3`} />
      </Field>
    </div>
  );
}

export interface ActivityDefaults {
  date: string;
  sport?: Sport;
  title?: string;
  durationMin?: number;
  /** Durata già scritta come tempo (es. 1:05:30), più precisa dei minuti. */
  durationText?: string;
  distanceKm?: number;
  avgHr?: number;
  avgPowerW?: number;
  elevationM?: number;
  /** Da dove vengono i valori: compilati a mano o letti da uno screenshot (da controllare). */
  source?: "manuale" | "screenshot";
  /** Intertempi letti dallo screenshot. */
  splits?: import("@/lib/domain/types").Split[];
}

export function ActivityForm({ defaults, plannedId, sports, today, demo }: { defaults: ActivityDefaults; plannedId?: string; sports: Sport[]; today: string; demo?: boolean }) {
  const [state, action, pending] = useActionState<LogState, FormData>(logActivity, {});
  const [sport, setSport] = useState<Sport>(defaults.sport ?? sports[0] ?? "run");
  const [confirmDup, setConfirmDup] = useState(false);
  const hasDistance = sport !== "gym";

  return (
    <form action={action} className="flex flex-col gap-5">
      {plannedId && <input type="hidden" name="plannedId" value={plannedId} />}
      <input type="hidden" name="confirmDuplicate" value={confirmDup ? "1" : ""} />
      <input type="hidden" name="source" value={defaults.source ?? "manuale"} />
      {defaults.splits?.length ? <input type="hidden" name="splits" value={JSON.stringify(defaults.splits)} /> : null}

      {plannedId ? (
        <input type="hidden" name="sport" value={sport} />
      ) : (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Sport</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SPORT_KEYS.filter((s) => sports.includes(s)).map((s) => (
              <label key={s} className="cursor-pointer">
                <input type="radio" name="sport" value={s} checked={sport === s} onChange={() => setSport(s)} className="peer sr-only" />
                <span
                  className="flex min-h-12 items-center justify-center rounded-xl border border-line text-sm font-semibold text-muted"
                  style={sport === s ? { borderColor: SPORTS[s].colorVar, background: SPORTS[s].softVar, color: SPORTS[s].colorVar } : undefined}
                >
                  {SPORTS[s].label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Data"><input name="date" type="date" defaultValue={defaults.date} max={today} className={inputCls} /></Field>
        <Field label="Ora di inizio" hint="Facoltativa"><input name="startTime" type="time" className={inputCls} /></Field>
        {!plannedId && <Field label="Titolo" hint="Facoltativo"><input name="title" defaultValue={defaults.title} maxLength={120} className={inputCls} /></Field>}
        <Field label="Durata" hint="Minuti (es. 45) oppure tempo (es. 1:05:30)">
          <input name="duration" inputMode="numeric" defaultValue={defaults.durationText ?? defaults.durationMin ?? ""} required className={inputCls} />
        </Field>
        {hasDistance && (
          <Field label={sport === "swim" ? "Distanza (km, es. 1,5)" : "Distanza (km)"} hint="Facoltativa">
            <input name="distanceKm" inputMode="decimal" defaultValue={defaults.distanceKm ?? ""} className={inputCls} />
          </Field>
        )}
        {hasDistance && <Field label="Frequenza cardiaca media" hint="Facoltativa, battiti al minuto"><input name="avgHr" inputMode="numeric" defaultValue={defaults.avgHr ?? ""} className={inputCls} /></Field>}
        {sport === "bike" && <Field label="Potenza media (W)" hint="Facoltativa"><input name="avgPowerW" inputMode="numeric" defaultValue={defaults.avgPowerW ?? ""} className={inputCls} /></Field>}
        {(sport === "bike" || sport === "run") && <Field label="Dislivello (m)" hint="Facoltativo"><input name="elevationM" inputMode="numeric" defaultValue={defaults.elevationM ?? ""} className={inputCls} /></Field>}
      </div>

      <div className="rounded-[var(--radius-card)] border border-line bg-surface/40 p-4 sm:p-5">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-muted">Com&apos;è andata</h3>
        <FeedbackFields />
      </div>

      {state.errors && (
        <ul role="alert" className="flex flex-col gap-1 rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-bad">
          {state.errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}
      {state.duplicate && !confirmDup && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
          <p>{state.duplicate}</p>
          <p className="text-muted">Se è la stessa, non salvarla di nuovo. Se è un&apos;altra seduta, salvala comunque.</p>
          <button type="button" onClick={() => setConfirmDup(true)} className="min-h-11 self-start rounded-xl border border-warn/60 px-4 font-semibold">È un&apos;altra attività</button>
        </div>
      )}

      <button disabled={pending || demo} className="sticky bottom-20 min-h-12 rounded-xl bg-ok text-base font-semibold text-bg shadow-lg shadow-black/40 disabled:opacity-50 md:bottom-4">
        {pending ? "Salvataggio..." : confirmDup ? "Salva comunque" : "Salva attività"}
      </button>
      {demo && <p className="text-sm text-muted">In modalità dimostrativa non si salva.</p>}
    </form>
  );
}

const SKIP_REASONS = ["Lavoro", "Famiglia", "Stanchezza", "Malessere", "Dolore", "Meteo", "Viaggio", "Altro"];

export function SkipForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState<SkipState, FormData>(skipWorkout, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Perché? <span className="text-xs font-normal text-muted">(facoltativo, aiuta il coach a riorganizzare)</span></legend>
        <div className="flex flex-wrap gap-2">
          {SKIP_REASONS.map((r) => (
            <label key={r} className="cursor-pointer">
              <input type="radio" name="reason" value={r} className="peer sr-only" />
              <span className="flex min-h-11 items-center rounded-xl border border-line px-4 text-sm font-semibold text-muted peer-checked:border-fg peer-checked:bg-fg peer-checked:text-bg">{r}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Nota" hint="Facoltativa"><input name="note" maxLength={200} className={inputCls} /></Field>
      {state.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      <button disabled={pending} className="min-h-12 rounded-xl border border-bad/50 bg-bad/10 text-sm font-semibold text-bad disabled:opacity-50">Segna come saltata</button>
    </form>
  );
}
