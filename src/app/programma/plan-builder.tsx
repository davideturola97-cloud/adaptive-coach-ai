"use client";

import clsx from "clsx";
import { AlertTriangle, Flag } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { SportDot } from "@/components/ui";
import { formatDayMonth, weekdayName } from "@/lib/dates";
import { SPORT_KEYS, SPORTS, WORKOUT_TYPE_LABEL } from "@/lib/domain/sports";
import { PHASE_LABEL, type PlanWeek } from "@/lib/planning/engine";
import { formatDuration } from "@/lib/training/formulas";
import { previewPlan, savePlan, type PreviewState } from "./actions";

const PHASE_COLOR: Record<string, string> = {
  base: "var(--color-muted)", costruzione: "var(--color-bike)", rifinitura: "var(--color-swim)",
  scarico: "var(--color-estimate)", gara: "var(--color-run)", recupero: "var(--color-ok)",
};

function WeekBar({ w, max }: { w: PlanWeek; max: number }) {
  return (
    <div className="flex h-3 overflow-hidden rounded-full bg-surface-2" style={{ width: `${Math.max(8, (w.plannedMin / max) * 100)}%` }}>
      {SPORT_KEYS.filter((s) => w.bySport[s]).map((s) => (
        <span key={s} style={{ width: `${(w.bySport[s]! / w.plannedMin) * 100}%`, background: SPORTS[s].colorVar }} />
      ))}
    </div>
  );
}

export function PlanBuilder({ demo, hasPlan }: { demo: boolean; hasPlan: boolean }) {
  const [weeks, setWeeks] = useState(12);
  const [preview, doPreview, previewing] = useActionState<PreviewState, FormData>(previewPlan, {});
  const [saved, doSave, saving] = useActionState<PreviewState, FormData>(savePlan, {});
  const draft = preview.draft;
  const max = draft ? Math.max(...draft.weeks.map((w) => w.plannedMin), 1) : 1;

  return (
    <div className="flex flex-col gap-5">
      <form action={doPreview} className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:flex-row sm:items-end sm:p-5">
        <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium">
          Quante settimane preparare
          <select name="weeks" value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} className="min-h-12 rounded-xl border border-line bg-bg px-4 text-base">
            {[4, 8, 12, 16, 20].map((n) => <option key={n} value={n}>{n} settimane</option>)}
          </select>
        </label>
        <button disabled={previewing} className="min-h-12 rounded-xl bg-fg px-6 text-sm font-semibold text-bg disabled:opacity-50">
          {previewing ? "Calcolo..." : hasPlan ? "Rigenera anteprima" : "Crea anteprima"}
        </button>
      </form>
      {demo && <p className="text-sm text-muted">In modalità dimostrativa puoi vedere l&apos;anteprima, ma non salvarla.</p>}
      {preview.error && <p role="alert" className="rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-bad">{preview.error}</p>}

      {draft && (
        <>
          {draft.warnings.length > 0 && (
            <div className="flex flex-col gap-1 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
              {draft.warnings.slice(0, 5).map((w) => <p key={w} className="flex gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />{w}</p>)}
            </div>
          )}

          <section className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-5">
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Le settimane</h2>
            <ol className="flex flex-col divide-y divide-line">
              {draft.weeks.map((w) => (
                <li key={w.weekStart} className="grid grid-cols-[4.5rem_1fr] items-center gap-3 py-2.5 sm:grid-cols-[5rem_8.5rem_1fr_4rem]">
                  <span className="text-sm tabular-nums">{formatDayMonth(w.weekStart)}</span>
                  <span className="text-xs font-semibold" style={{ color: PHASE_COLOR[w.phase] }}>
                    {PHASE_LABEL[w.phase]}
                    {w.race && <span className="ml-1 inline-flex items-center gap-1 text-run"><Flag className="size-3" aria-hidden />{w.race.name}</span>}
                  </span>
                  <div className="col-span-2 sm:col-span-1"><WeekBar w={w} max={max} /></div>
                  <span className="hidden text-right text-sm tabular-nums sm:block">{formatDuration(w.plannedMin)}</span>
                </li>
              ))}
            </ol>
            <p className="flex flex-wrap gap-3 pt-2 text-xs text-muted">
              {SPORT_KEYS.filter((s) => draft.weeks.some((w) => w.bySport[s])).map((s) => <span key={s} className="flex items-center gap-1.5"><SportDot sport={s} />{SPORTS[s].label}</span>)}
            </p>
          </section>

          <section className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-5">
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Le prime due settimane</h2>
            <ul className="flex flex-col divide-y divide-line">
              {draft.workouts.filter((w) => w.date < (draft.weeks[2]?.weekStart ?? draft.endDate)).map((w, i) => (
                <li key={`${w.date}-${w.type}-${i}`} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="w-20 shrink-0 text-muted">{weekdayName(w.date, true)} {formatDayMonth(w.date)}</span>
                  <SportDot sport={w.sport} />
                  <span className="min-w-0 flex-1 truncate font-medium">{w.title}</span>
                  <span className="hidden text-xs text-muted sm:inline">{WORKOUT_TYPE_LABEL[w.type]}</span>
                  <span className="w-14 text-right tabular-nums">{formatDuration(w.durationMin)}</span>
                </li>
              ))}
            </ul>
          </section>

          <form action={doSave} className="flex flex-col gap-3">
            <input type="hidden" name="weeks" value={preview.weeks ?? weeks} />
            {hasPlan && <p className="text-sm text-muted">Le sedute già fatte restano. Quelle future vengono sostituite; la versione precedente viene conservata.</p>}
            <button disabled={saving || demo} className={clsx("min-h-12 rounded-xl bg-ok text-base font-semibold text-bg disabled:opacity-50")}>
              {saving ? "Salvataggio..." : "Conferma e salva il programma"}
            </button>
            {saved.error && <p role="alert" className="rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-bad">{saved.error}</p>}
            {saved.saved && (
              <p role="status" className="rounded-xl border border-ok/40 bg-ok/10 px-4 py-3 text-sm text-ok">
                {saved.saved} <Link href="/calendario" className="font-semibold underline">Apri il calendario</Link>
              </p>
            )}
          </form>
        </>
      )}
    </div>
  );
}
