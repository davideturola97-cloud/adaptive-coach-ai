"use client";

import clsx from "clsx";
import { useActionState, useState } from "react";
import { Chip, EventFields, Field, Fieldset, inputCls, SportsFields } from "@/components/form";
import { WEEK_DAYS } from "@/lib/domain/profile-schema";
import type { AthleteProfile } from "@/lib/domain/types";
import { READINESS_QUESTIONS } from "@/lib/training/tests";
import { completeOnboarding, type OnboardingState } from "./actions";

const STEPS = ["Chi sei", "Sport", "Disponibilità", "Salute", "Obiettivi e gare"] as const;

const EQUIPMENT = [
  "Orologio GPS", "Fascia cardio", "Bici da strada", "Bici da crono/triathlon", "Rulli smart",
  "Misuratore di potenza", "Accesso a una piscina", "Muta", "Palestra attrezzata", "Manubri o elastici a casa",
];

export function OnboardingWizard({ a }: { a: AthleteProfile }) {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(completeOnboarding, {});
  const [step, setStep] = useState(0);
  const [events, setEvents] = useState<number[]>([0]);
  const [nextId, setNextId] = useState(1);
  const last = step === STEPS.length - 1;

  return (
    <form
      action={action}
      onSubmit={(e) => {
        // Invio (anche col tasto Invio) solo dall'ultimo passo: prima si va avanti.
        if (!last) {
          e.preventDefault();
          setStep(step + 1);
        }
      }}
      className="flex flex-col gap-5"
    >
      <ol className="flex gap-1.5" aria-label="Avanzamento">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1">
            <span className={clsx("block h-1.5 rounded-full", i <= step ? "bg-fg" : "bg-line")} />
            <span className={clsx("mt-1.5 hidden text-[11px] sm:block", i === step ? "text-fg" : "text-faint")}>{s}</span>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted">Passo {step + 1} di {STEPS.length}: <span className="font-semibold text-fg">{STEPS[step]}</span></p>

      {/* Tutti i passi restano nel modulo: quelli non visibili sono solo nascosti, così l'invio finale li include. */}
      <div hidden={step !== 0}>
        <Fieldset title="Chi sei">
          <Field label="Come ti chiami?"><input name="displayName" defaultValue={a.name === "Atleta" ? "" : a.name} maxLength={80} className={inputCls} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data di nascita"><input name="birthDate" type="date" defaultValue={a.birthDate} className={inputCls} /></Field>
            <Field label="Sesso" hint="Facoltativo">
              <select name="sex" defaultValue={a.sex ?? ""} className={inputCls}>
                <option value="">Preferisco non dirlo</option>
                <option value="M">Maschio</option>
                <option value="F">Femmina</option>
                <option value="altro">Altro</option>
              </select>
            </Field>
            <Field label="Altezza (cm)"><input name="heightCm" inputMode="decimal" defaultValue={a.heightCm ?? ""} className={inputCls} /></Field>
            <Field label="Peso (kg)"><input name="weightKg" inputMode="decimal" defaultValue={a.weightKg ?? ""} className={inputCls} /></Field>
          </div>
        </Fieldset>
      </div>

      <div hidden={step !== 1}>
        <Fieldset title="I tuoi sport">
          <SportsFields a={a} />
        </Fieldset>
      </div>

      <div hidden={step !== 2}>
        <Fieldset title="Quanto tempo hai">
          <div className="flex flex-col gap-2 text-sm font-medium">
            In quali giorni puoi allenarti?
            <div className="flex flex-wrap gap-2">
              {WEEK_DAYS.map((d) => <Chip key={d} name="availableDays" value={d} label={d} defaultChecked={a.availableDays.includes(d)} />)}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ore totali a settimana"><input name="weeklyHoursAvailable" inputMode="decimal" defaultValue={a.weeklyHoursAvailable ?? ""} placeholder="Es. 8" className={inputCls} /></Field>
            <Field label="Seduta più lunga possibile (minuti)"><input name="maxSessionMin" inputMode="numeric" defaultValue={a.maxSessionMin ?? ""} placeholder="Es. 150" className={inputCls} /></Field>
          </div>
          <div className="flex flex-col gap-2 text-sm font-medium">
            Attrezzatura che hai
            <div className="flex flex-wrap gap-2">
              {EQUIPMENT.map((e) => <Chip key={e} name="equipmentChip" value={e} label={e} defaultChecked={a.equipment.includes(e)} />)}
            </div>
          </div>
          <Field label="Altro" hint="Facoltativo, una voce per riga">
            <textarea name="equipmentOther" rows={2} defaultValue={a.equipment.filter((e) => !EQUIPMENT.includes(e)).join("\n")} className={`${inputCls} py-3`} />
          </Field>
        </Fieldset>
      </div>

      <div hidden={step !== 3}>
        <Fieldset title="Salute">
          <Field label="Limitazioni fisiche o infortuni" hint="Facoltativo. Il coach ne terrà conto, ma non sostituisce un medico.">
            <textarea name="limitations" rows={3} defaultValue={a.limitations.join("\n")} placeholder="Es. Tendine d'Achille sensibile" className={`${inputCls} py-3`} />
          </Field>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">Prima di proporti test a tutta, qualche domanda di sicurezza. Rispondi con sincerità: serve solo a proteggerti.</p>
            {READINESS_QUESTIONS.map((q) => (
              <div key={q.id} className="flex flex-col gap-2 rounded-xl border border-line p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm">{q.text}</p>
                <div className="grid shrink-0 grid-cols-2 gap-2">
                  {(["no", "si"] as const).map((v) => (
                    <label key={v} className="cursor-pointer">
                      <input type="radio" name={`q.${q.id}`} value={v} defaultChecked={v === "no"} className="peer sr-only" />
                      <span className="flex min-h-11 min-w-16 items-center justify-center rounded-xl border border-line text-sm font-semibold text-muted peer-checked:border-fg peer-checked:bg-fg peer-checked:text-bg">
                        {v === "si" ? "Sì" : "No"}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Fieldset>
      </div>

      <div hidden={step !== 4} className="flex flex-col gap-5">
        <Fieldset title="Obiettivi">
          <Field label="Obiettivo principale"><input name="goalPrimary" maxLength={200} defaultValue={a.goals.primary} placeholder="Es. Finire il Ledroman" className={inputCls} /></Field>
          <Field label="Obiettivi secondari" hint="Facoltativo, uno per riga"><textarea name="goalsSecondary" rows={2} defaultValue={a.goals.secondary.join("\n")} placeholder={"Mezza di Ravenna sotto 1:40\nPiù costanza"} className={`${inputCls} py-3`} /></Field>
        </Fieldset>
        <Fieldset title="Le tue gare">
          <p className="text-sm text-muted">Aggiungi le gare in calendario, anche con data indicativa. Puoi lasciare vuoto se non ne hai.</p>
          {events.map((id) => (
            <div key={id}>
              <input type="hidden" name="eventIndex" value={id} />
              <EventFields prefix={`ev${id}.`} onRemove={events.length > 1 ? () => setEvents(events.filter((x) => x !== id)) : undefined} />
            </div>
          ))}
          <button type="button" onClick={() => { setEvents([...events, nextId]); setNextId(nextId + 1); }} className="min-h-12 rounded-xl border border-dashed border-faint text-sm font-semibold text-muted hover:text-fg">
            + Aggiungi un&apos;altra gara
          </button>
        </Fieldset>
      </div>

      {state.errors && (
        <ul role="alert" className="flex flex-col gap-1 rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-bad">
          {state.errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}

      <div className="sticky bottom-20 grid grid-cols-2 gap-3 md:bottom-4">
        <button type="button" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="min-h-12 rounded-xl border border-line bg-surface text-base font-semibold disabled:opacity-40">
          Indietro
        </button>
        {last ? (
          <button key="fatto" type="submit" disabled={pending} className="min-h-12 rounded-xl bg-fg text-base font-semibold text-bg disabled:opacity-60">
            {pending ? "Salvataggio..." : "Fatto"}
          </button>
        ) : (
          <button key="avanti" type="button" onClick={(e) => { e.preventDefault(); setStep(step + 1); window.scrollTo({ top: 0 }); }} className="min-h-12 rounded-xl bg-fg text-base font-semibold text-bg">
            Avanti
          </button>
        )}
      </div>
    </form>
  );
}
