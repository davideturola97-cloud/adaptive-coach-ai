"use client";

import { useActionState } from "react";
import { DaysFields, Field, Fieldset, inputCls, SportsFields } from "@/components/form";
import type { AthleteProfile } from "@/lib/domain/types";
import { updateProfile, type ProfileState } from "../actions";

export function ProfileForm({ a }: { a: AthleteProfile }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(updateProfile, {});

  return (
    <form action={action} className="flex flex-col gap-5">
      <Fieldset title="Dati personali">
        <Field label="Nome"><input id="displayName" name="displayName" defaultValue={a.name === "Atleta" ? "" : a.name} required maxLength={80} className={inputCls} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Data di nascita"><input id="birthDate" name="birthDate" type="date" defaultValue={a.birthDate} className={inputCls} /></Field>
          <Field label="Sesso" hint="Facoltativo">
            <select id="sex" name="sex" defaultValue={a.sex ?? ""} className={inputCls}>
              <option value="">Preferisco non dirlo</option>
              <option value="M">Maschio</option>
              <option value="F">Femmina</option>
              <option value="altro">Altro</option>
            </select>
          </Field>
          <Field label="Altezza (cm)"><input id="heightCm" name="heightCm" inputMode="decimal" defaultValue={a.heightCm ?? ""} className={inputCls} /></Field>
          <Field label="Peso (kg)"><input id="weightKg" name="weightKg" inputMode="decimal" defaultValue={a.weightKg ?? ""} className={inputCls} /></Field>
        </div>
      </Fieldset>

      <Fieldset title="Sport">
        <SportsFields a={a} />
      </Fieldset>

      <Fieldset title="Disponibilità">
        <DaysFields a={a} practiced={a.sports.map((s) => s.sport)} />
        <Field label="Attrezzatura" hint="Una voce per riga o separate da virgola"><textarea id="equipment" name="equipment" rows={3} defaultValue={a.equipment.join("\n")} className={`${inputCls} py-3`} /></Field>
      </Fieldset>

      <Fieldset title="Salute e obiettivi">
        <Field label="Limitazioni fisiche o infortuni" hint="Il coach ne terrà conto. Non sostituisce il parere di un medico."><textarea id="limitations" name="limitations" rows={3} defaultValue={a.limitations.join("\n")} className={`${inputCls} py-3`} /></Field>
        <Field label="Obiettivo principale"><input id="goalPrimary" name="goalPrimary" maxLength={200} defaultValue={a.goals.primary} placeholder="Es. Finire il mio primo triathlon medio" className={inputCls} /></Field>
        <Field label="Obiettivi secondari" hint="Uno per riga"><textarea id="goalsSecondary" name="goalsSecondary" rows={2} defaultValue={a.goals.secondary.join("\n")} className={`${inputCls} py-3`} /></Field>
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
