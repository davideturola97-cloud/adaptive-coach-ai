"use client";

import { useActionState } from "react";
import { LEVELS, WEEK_DAYS } from "@/lib/domain/profile-schema";
import type { AthleteProfile, Sport } from "@/lib/domain/types";
import { updateProfile, type ProfileState } from "../actions";

const input = "min-h-12 w-full rounded-xl border border-line bg-surface px-4 text-base outline-none focus:border-fg";
const labelCls = "flex flex-col gap-1.5 text-sm font-medium";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className={labelCls}>
      {label}
      {children}
      {hint && <span className="text-xs font-normal text-muted">{hint}</span>}
    </label>
  );
}

function Fieldset({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface/40 p-4 sm:p-5">
      <legend className="px-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted">{title}</legend>
      {children}
    </fieldset>
  );
}

export function ProfileForm({ a }: { a: AthleteProfile }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(updateProfile, {});
  const sport = (k: Sport) => a.sports.find((s) => s.sport === k);

  return (
    <form action={action} className="flex flex-col gap-5">
      <Fieldset title="Dati personali">
        <Field label="Nome"><input id="displayName" name="displayName" defaultValue={a.name === "Atleta" ? "" : a.name} required maxLength={80} className={input} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Data di nascita"><input id="birthDate" name="birthDate" type="date" defaultValue={a.birthDate} className={input} /></Field>
          <Field label="Sesso" hint="Facoltativo">
            <select id="sex" name="sex" defaultValue={a.sex ?? ""} className={input}>
              <option value="">Preferisco non dirlo</option>
              <option value="M">Maschio</option>
              <option value="F">Femmina</option>
              <option value="altro">Altro</option>
            </select>
          </Field>
          <Field label="Altezza (cm)"><input id="heightCm" name="heightCm" inputMode="decimal" defaultValue={a.heightCm ?? ""} className={input} /></Field>
          <Field label="Peso (kg)"><input id="weightKg" name="weightKg" inputMode="decimal" defaultValue={a.weightKg ?? ""} className={input} /></Field>
        </div>
      </Fieldset>

      <Fieldset title="Sport">
        {(["run", "bike"] as const).map((k) => {
          const s = sport(k);
          return (
            <div key={k} className="flex flex-col gap-3 rounded-xl border border-line p-3">
              <label className="flex items-center gap-3 text-base font-semibold">
                <input id={`${k}.enabled`} name={`${k}.enabled`} type="checkbox" defaultChecked={Boolean(s)} className="size-5 accent-run" />
                <span style={{ color: k === "run" ? "var(--color-run)" : "var(--color-bike)" }}>{k === "run" ? "Corsa" : "Ciclismo"}</span>
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Livello">
                  <select id={`${k}.level`} name={`${k}.level`} defaultValue={s?.level ?? "principiante"} className={input}>
                    {LEVELS.map((l) => <option key={l} value={l} className="capitalize">{l}</option>)}
                  </select>
                </Field>
                <Field label="Anni di esperienza"><input id={`${k}.yearsExperience`} name={`${k}.yearsExperience`} inputMode="decimal" defaultValue={s?.yearsExperience ?? ""} className={input} /></Field>
                <Field label="Volume attuale" hint={k === "run" ? "Es. 30 km a settimana" : "Es. 4 ore a settimana"}><input id={`${k}.weeklyVolume`} name={`${k}.weeklyVolume`} maxLength={200} defaultValue={s?.weeklyVolume ?? ""} className={input} /></Field>
              </div>
            </div>
          );
        })}
      </Fieldset>

      <Fieldset title="Disponibilità">
        <div className="flex flex-col gap-2 text-sm font-medium">
          Giorni in cui puoi allenarti
          <div className="flex flex-wrap gap-2">
            {WEEK_DAYS.map((d) => (
              <label key={d} className="cursor-pointer">
                <input type="checkbox" name="availableDays" value={d} defaultChecked={a.availableDays.includes(d)} className="peer sr-only" />
                <span className="flex min-h-11 min-w-12 items-center justify-center rounded-xl border border-line px-3 text-sm text-muted peer-checked:border-fg peer-checked:bg-fg peer-checked:text-bg peer-focus-visible:outline peer-focus-visible:outline-2">{d}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ore a settimana"><input id="weeklyHoursAvailable" name="weeklyHoursAvailable" inputMode="decimal" defaultValue={a.weeklyHoursAvailable ?? ""} className={input} /></Field>
          <Field label="Durata massima di una seduta (minuti)"><input id="maxSessionMin" name="maxSessionMin" inputMode="numeric" defaultValue={a.maxSessionMin ?? ""} className={input} /></Field>
        </div>
        <Field label="Attrezzatura" hint="Una voce per riga o separate da virgola"><textarea id="equipment" name="equipment" rows={3} defaultValue={a.equipment.join("\n")} className={`${input} py-3`} /></Field>
      </Fieldset>

      <Fieldset title="Salute e obiettivi">
        <Field label="Limitazioni fisiche o infortuni" hint="Il coach ne terrà conto. Non sostituisce il parere di un medico."><textarea id="limitations" name="limitations" rows={3} defaultValue={a.limitations.join("\n")} className={`${input} py-3`} /></Field>
        <Field label="Obiettivo principale"><input id="goalPrimary" name="goalPrimary" maxLength={200} defaultValue={a.goals.primary} placeholder="Es. Mezza maratona sotto 1:40" className={input} /></Field>
        <Field label="Obiettivi secondari" hint="Uno per riga"><textarea id="goalsSecondary" name="goalsSecondary" rows={2} defaultValue={a.goals.secondary.join("\n")} className={`${input} py-3`} /></Field>
        <p className="text-xs text-muted">Le date delle gare si inseriscono nell&apos;onboarding (prossima milestone).</p>
      </Fieldset>

      {state.errors && (
        <ul role="alert" className="flex flex-col gap-1 rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-bad">
          {state.errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}

      <button type="submit" disabled={pending} className="sticky bottom-20 min-h-12 rounded-xl bg-fg text-base font-semibold text-bg shadow-lg shadow-black/40 disabled:opacity-60 md:bottom-4">
        {pending ? "Salvataggio..." : "Salva profilo"}
      </button>
    </form>
  );
}
