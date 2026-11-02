"use client";

import clsx from "clsx";
import { useState } from "react";
import { SPORT_KEYS, SPORTS, TRI_FORMATS } from "@/lib/domain/sports";
import type { AthleteProfile, RaceEvent, Sport } from "@/lib/domain/types";
import { LEVELS, STROKES } from "@/lib/domain/profile-schema";
import { SportIcon } from "./ui";

export const inputCls = "min-h-12 w-full rounded-xl border border-line bg-surface px-4 text-base outline-none focus:border-fg";

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      {children}
      {hint && <span className="text-xs font-normal text-muted">{hint}</span>}
    </label>
  );
}

export function Fieldset({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <fieldset className={clsx("flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface/40 p-4 sm:p-5", className)}>
      <legend className="px-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted">{title}</legend>
      {children}
    </fieldset>
  );
}

/** Casella a forma di pulsante (giorni, stili, attrezzatura). */
export function Chip({ name, value, label, defaultChecked }: { name: string; value: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="cursor-pointer">
      <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="flex min-h-11 min-w-12 items-center justify-center rounded-xl border border-line px-3 text-sm text-muted peer-checked:border-fg peer-checked:bg-fg peer-checked:text-bg peer-focus-visible:outline peer-focus-visible:outline-2">
        {label}
      </span>
    </label>
  );
}

export function Toggle({ name, label, defaultChecked, hint }: { name: string; label: string; defaultChecked?: boolean; hint?: string }) {
  return (
    <label className="flex min-h-11 items-start gap-3 text-sm">
      <input id={name} name={name} type="checkbox" defaultChecked={defaultChecked} className="mt-0.5 size-5 shrink-0 accent-run" />
      <span>
        {label}
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

/** Scelta degli sport con livello, esperienza e volume; per il nuoto anche vasca, acque libere e stili. */
export function SportsFields({ a }: { a?: AthleteProfile }) {
  const initial = Object.fromEntries(SPORT_KEYS.map((k) => [k, Boolean(a?.sports.some((s) => s.sport === k))])) as Record<Sport, boolean>;
  const [on, setOn] = useState(initial);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">Scegli gli sport che pratichi: uno, alcuni o tutti. Per il triathlon seleziona nuoto, bici e corsa.</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {SPORT_KEYS.map((k) => (
          <label key={k} className="cursor-pointer">
            <input
              type="checkbox"
              name={`${k}.enabled`}
              checked={on[k]}
              onChange={(e) => setOn({ ...on, [k]: e.target.checked })}
              className="peer sr-only"
            />
            <span
              className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border border-line text-sm font-semibold text-muted peer-focus-visible:outline peer-focus-visible:outline-2"
              style={on[k] ? { borderColor: SPORTS[k].colorVar, background: SPORTS[k].softVar, color: SPORTS[k].colorVar } : undefined}
            >
              <SportIcon sport={k} className="size-5" />
              {SPORTS[k].label}
            </span>
          </label>
        ))}
      </div>
      {SPORT_KEYS.filter((k) => on[k]).map((k) => {
        const s = a?.sports.find((x) => x.sport === k);
        return (
          <div key={k} className="flex flex-col gap-3 rounded-xl border p-3" style={{ borderColor: SPORTS[k].softVar }}>
            <p className="flex items-center gap-2 font-semibold" style={{ color: SPORTS[k].colorVar }}>
              <SportIcon sport={k} /> {SPORTS[k].label}
              {k === "gym" && <span className="text-xs font-normal text-muted">di supporto agli altri sport</span>}
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Livello">
                <select id={`${k}.level`} name={`${k}.level`} defaultValue={s?.level ?? "principiante"} className={inputCls}>
                  {LEVELS.map((l) => <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>)}
                </select>
              </Field>
              <Field label="Anni di esperienza">
                <input id={`${k}.yearsExperience`} name={`${k}.yearsExperience`} inputMode="decimal" defaultValue={s?.yearsExperience ?? ""} className={inputCls} />
              </Field>
              <Field label="Volume attuale" hint={SPORTS[k].volumeHint}>
                <input id={`${k}.weeklyVolume`} name={`${k}.weeklyVolume`} maxLength={200} defaultValue={s?.weeklyVolume ?? ""} className={inputCls} />
              </Field>
            </div>
            {k === "swim" && (
              <div className="flex flex-col gap-3 border-t border-line pt-3">
                <Field label="Vasca in cui nuoti di solito">
                  <select id="swim.poolLengthM" name="swim.poolLengthM" defaultValue={a?.swim?.poolLengthM ?? ""} className={inputCls}>
                    <option value="">Non so / non nuoto in vasca</option>
                    <option value="25">25 metri</option>
                    <option value="50">50 metri</option>
                  </select>
                </Field>
                <div className="flex flex-col gap-2 text-sm font-medium">
                  Stili che sai nuotare
                  <div className="flex flex-wrap gap-2">
                    {STROKES.map((st) => <Chip key={st} name="swim.strokes" value={st} label={st} defaultChecked={a?.swim?.strokes.includes(st) ?? st === "Stile libero"} />)}
                  </div>
                </div>
                <Toggle name="swim.canSwim400" label="Riesco a nuotare 400 m senza fermarmi" defaultChecked hint="Serve per proporti il test giusto." />
                <Toggle name="swim.openWater" label="Nuoto anche in acque libere (lago, mare)" defaultChecked={a?.swim?.openWater} />
                <Toggle name="swim.wetsuit" label="Ho la muta" defaultChecked={a?.swim?.wetsuit} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Campi di una gara. `prefix` permette più gare nello stesso modulo. */
export function EventFields({ prefix = "", e, onRemove }: { prefix?: string; e?: RaceEvent; onRemove?: () => void }) {
  const [kind, setKind] = useState<"singolo" | "triathlon">(e?.kind ?? "singolo");
  const [format, setFormat] = useState<string>(e?.triFormat ?? "olimpico");
  const n = (k: string) => `${prefix}${k}`;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line p-3">
      <div className="grid grid-cols-2 gap-2">
        {(["singolo", "triathlon"] as const).map((k) => (
          <label key={k} className="cursor-pointer">
            <input type="radio" name={n("kind")} value={k} checked={kind === k} onChange={() => setKind(k)} className="peer sr-only" />
            <span className="flex min-h-11 items-center justify-center rounded-xl border border-line text-sm font-semibold text-muted peer-checked:border-fg peer-checked:bg-fg peer-checked:text-bg">
              {k === "singolo" ? "Gara di uno sport" : "Triathlon"}
            </span>
          </label>
        ))}
      </div>
      <Field label="Nome della gara"><input name={n("name")} defaultValue={e?.name} maxLength={120} placeholder={kind === "triathlon" ? "Es. Ledroman" : "Es. Mezza maratona di Ravenna"} className={inputCls} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Data"><input name={n("date")} type="date" defaultValue={e?.date} className={inputCls} /></Field>
        <Field label="Importanza" hint="A = obiettivo principale, C = gara di allenamento">
          <select name={n("priority")} defaultValue={e?.priority ?? "A"} className={inputCls}>
            <option value="A">A · principale</option>
            <option value="B">B · importante</option>
            <option value="C">C · di preparazione</option>
          </select>
        </Field>
      </div>
      <Toggle name={n("dateTentative")} label="La data non è ancora ufficiale" defaultChecked={e?.dateTentative} />
      {kind === "singolo" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Sport">
            <select name={n("sport")} defaultValue={e?.sport ?? "run"} className={inputCls}>
              {(["run", "bike", "swim"] as const).map((s) => <option key={s} value={s}>{SPORTS[s].label}</option>)}
            </select>
          </Field>
          <Field label="Distanza (km)"><input name={n("distanceKm")} inputMode="decimal" defaultValue={e?.distanceKm ?? ""} placeholder="Es. 21,1" className={inputCls} /></Field>
        </div>
      ) : (
        <>
          <Field label="Formato">
            <select name={n("triFormat")} value={format} onChange={(ev) => setFormat(ev.target.value)} className={inputCls}>
              {Object.entries(TRI_FORMATS).map(([k, f]) => (
                <option key={k} value={k}>{f.label} · {[f.swimKm, f.bikeKm, f.runKm].map((x) => x.toLocaleString("it-IT")).join(" + ")} km</option>
              ))}
              <option value="personalizzato">Distanze personalizzate</option>
            </select>
          </Field>
          {format === "personalizzato" && (
            <div className="grid grid-cols-3 gap-2">
              <Field label="Nuoto km"><input name={n("swimKm")} inputMode="decimal" defaultValue={e?.legs?.swimKm ?? ""} className={inputCls} /></Field>
              <Field label="Bici km"><input name={n("bikeKm")} inputMode="decimal" defaultValue={e?.legs?.bikeKm ?? ""} className={inputCls} /></Field>
              <Field label="Corsa km"><input name={n("runKm")} inputMode="decimal" defaultValue={e?.legs?.runKm ?? ""} className={inputCls} /></Field>
            </div>
          )}
        </>
      )}
      {onRemove && (
        <button type="button" onClick={onRemove} className="min-h-11 self-start rounded-xl px-3 text-sm font-semibold text-bad hover:bg-bad/10">
          Rimuovi questa gara
        </button>
      )}
    </div>
  );
}

/** Giorni disponibili, giorni dei lunghi e giorni preferiti per sport. */
export function DaysFields({ a, practiced }: { a?: AthleteProfile; practiced?: Sport[] }) {
  const days = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 text-sm font-medium">
        Giorni in cui puoi allenarti
        <div className="flex flex-wrap gap-2">
          {days.map((d) => <Chip key={d} name="availableDays" value={d} label={d} defaultChecked={a?.availableDays.includes(d)} />)}
        </div>
      </div>
      <div className="flex flex-col gap-2 text-sm font-medium">
        Giorni per i lunghi
        <span className="text-xs font-normal text-muted">Qui il coach mette lungo di corsa, uscita lunga in bici e combinati. Di solito sabato e domenica.</span>
        <div className="flex flex-wrap gap-2">
          {days.map((d) => <Chip key={d} name="longDays" value={d} label={d} defaultChecked={a ? a.longDays.includes(d) : d === "Sab" || d === "Dom"} />)}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Ore totali a settimana"><input name="weeklyHoursAvailable" inputMode="decimal" defaultValue={a?.weeklyHoursAvailable ?? ""} placeholder="Es. 8" className={inputCls} /></Field>
        <Field label="Seduta più lunga nei giorni normali (min)"><input name="maxSessionMin" inputMode="numeric" defaultValue={a?.maxSessionMin ?? ""} placeholder="Es. 75" className={inputCls} /></Field>
        <Field label="Seduta più lunga nei giorni dei lunghi (min)"><input name="longSessionMaxMin" inputMode="numeric" defaultValue={a?.longSessionMaxMin ?? ""} placeholder="Es. 180" className={inputCls} /></Field>
      </div>
      {practiced && practiced.length > 1 && (
        <details className="rounded-xl border border-line p-3">
          <summary className="min-h-8 cursor-pointer text-sm font-semibold">Giorni preferiti per sport (facoltativo)</summary>
          <p className="mt-1 text-xs text-muted">Per esempio il nuoto solo nei giorni in cui la piscina è aperta. Se lasci vuoto, va bene qualsiasi giorno disponibile.</p>
          <div className="mt-3 flex flex-col gap-3">
            {practiced.map((k) => (
              <div key={k} className="flex flex-col gap-2 text-sm font-medium">
                <span className="flex items-center gap-2" style={{ color: SPORTS[k].colorVar }}><SportIcon sport={k} /> {SPORTS[k].label}</span>
                <div className="flex flex-wrap gap-2">
                  {days.map((d) => <Chip key={d} name={`${k}.days`} value={d} label={d} defaultChecked={a?.sportDays[k]?.includes(d)} />)}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
