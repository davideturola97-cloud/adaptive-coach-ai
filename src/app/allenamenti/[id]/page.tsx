import { ArrowLeft, CheckCircle2, ShieldAlert, Lightbulb } from "lucide-react";
import { ActivityForm, SkipForm } from "@/components/activity-form";
import { ActivitySummary } from "@/components/activity-summary";
import { unskipWorkout } from "../actions";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, OriginTag, SectionTitle, SportBadge, StatusLabel } from "@/components/ui";
import { formatDayMonth, weekdayName } from "@/lib/dates";
import { WORKOUT_TYPE_LABEL } from "@/lib/domain/sports";
import type { WorkoutStep } from "@/lib/domain/types";
import { getAppData } from "@/lib/data/repository";
import { formatDuration } from "@/lib/training/formulas";
import { gymAdvice } from "@/lib/training/gym-schedule";
import { GymAdviceList } from "@/components/gym-advice";

export const dynamic = "force-dynamic";

function Step({ s }: { s: WorkoutStep }) {
  return (
    <li className="flex items-start justify-between gap-4 border-b border-line py-3 last:border-0">
      <div className="min-w-0">
        <p className="font-medium">
          {s.repeat ? <span className="num mr-1.5 text-lg">{s.repeat} ×</span> : null}
          {s.label}
        </p>
        {s.note && <p className="mt-0.5 text-sm text-muted">{s.note}</p>}
        {s.target && (
          <p className="mt-1 flex items-center gap-2 text-sm">
            {s.target.value} <OriginTag origin={s.target.origin} />
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        {s.durationMin !== undefined && <p className="num text-xl font-semibold">{formatDuration(s.durationMin)}</p>}
        <p className="text-xs text-muted">RPE {s.rpe[0] === s.rpe[1] ? s.rpe[0] : `${s.rpe[0]}–${s.rpe[1]}`}</p>
      </div>
    </li>
  );
}

export default async function WorkoutPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ salvato?: string }> }) {
  const { id } = await params;
  const { plan, activities, today, mode, athlete, events } = await getAppData();
  const { salvato } = await searchParams;
  const demo = mode === "demo";
  const w = plan.find((p) => p.id === id);
  if (!w) notFound();
  const done = w.completedActivityId ? activities.find((a) => a.id === w.completedActivityId) : undefined;

  return (
    <article className="flex flex-col gap-6">
      <Link href="/allenamenti" className="inline-flex min-h-11 w-fit items-center gap-2 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden /> Allenamenti
      </Link>

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <SportBadge sport={w.sport} />
          <span className="text-sm text-muted">{WORKOUT_TYPE_LABEL[w.type]}</span>
          <StatusLabel status={w.status} />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{w.title}</h1>
        <p className="text-muted">{weekdayName(w.date)} {formatDayMonth(w.date, false)}</p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card><p className="text-xs text-muted">Durata</p><p className="num text-3xl font-semibold">{formatDuration(w.durationMin)}</p></Card>
        <Card><p className="text-xs text-muted">Intensità</p><p className="mt-1 font-semibold">{w.intensity}</p></Card>
        <Card className="col-span-2 sm:col-span-1"><p className="text-xs text-muted">Obiettivo</p><p className="mt-1 text-sm">{w.objective}</p></Card>
      </div>

      <Card className="text-sm text-muted">
        {w.paceSource ? (
          <>
            Passi al km stimati dalla tua forma attuale: <b className="text-fg">{w.paceSource}</b>. Si aggiornano da soli a ogni corsa registrata.
            Se in una giornata il passo costa più fatica del previsto (caldo, salita, stanchezza), comanda l&apos;RPE: rallenta senza problemi.
          </>
        ) : (
          <>L&apos;intensità è indicata con la scala RPE da 1 a 10 (sforzo percepito). I passi al km compariranno dopo qualche corsa registrata o un test.</>
        )}
      </Card>

      {w.sport === "gym" && athlete.gymSchedule?.length ? (() => {
        const adv = gymAdvice(athlete.gymSchedule, plan, events, athlete, today).filter((x) => x.date === w.date);
        return adv.length ? (
          <section>
            <SectionTitle>Consiglio del coach</SectionTitle>
            <GymAdviceList advice={adv} />
          </section>
        ) : null;
      })() : null}

      <section>
        <SectionTitle>Struttura</SectionTitle>
        <Card className="flex flex-col gap-4">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">Riscaldamento</h3>
            <ul>{w.structure.warmup.map((s, i) => <Step key={i} s={s} />)}</ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">Parte centrale</h3>
            <ul>{w.structure.main.map((s, i) => <Step key={i} s={s} />)}</ul>
            {w.structure.recoveries && (
              <p className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">
                Recuperi: {w.structure.recoveries}
                {w.structure.recoveryTarget && (
                  <span className="flex items-center gap-2 text-fg">Passo: {w.structure.recoveryTarget.value} <OriginTag origin={w.structure.recoveryTarget.origin} /></span>
                )}
              </p>
            )}
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">Defaticamento</h3>
            <ul>{w.structure.cooldown.map((s, i) => <Step key={i} s={s} />)}</ul>
          </div>
        </Card>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section>
          <SectionTitle>Indicazioni tecniche</SectionTitle>
          <Card>
            <ul className="flex flex-col gap-2 text-sm">
              {w.technicalTips.map((t) => <li key={t} className="flex gap-2"><Lightbulb className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />{t}</li>)}
            </ul>
          </Card>
        </section>
        <section>
          <SectionTitle>Sicurezza</SectionTitle>
          <Card>
            <ul className="flex flex-col gap-2 text-sm">
              {w.safetyNotes.map((t) => <li key={t} className="flex gap-2"><ShieldAlert className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />{t}</li>)}
            </ul>
          </Card>
        </section>
      </div>

      {salvato && (
        <p role="status" className="flex items-center gap-2 rounded-xl border border-ok/40 bg-ok/10 px-4 py-3 text-sm text-ok">
          <CheckCircle2 className="size-5" aria-hidden /> Attività salvata. Grazie del feedback: il coach ne terrà conto.
        </p>
      )}

      {done && <ActivitySummary a={done} back={`/allenamenti/${w.id}`} editable={!demo} planned={w} athlete={athlete} history={activities} />}

      {w.status === "saltato" && (
        <Card className="flex flex-col gap-3 border-bad/40">
          <p className="font-semibold text-bad">Seduta saltata</p>
          {w.skipReason && <p className="text-sm text-muted">Motivo: {w.skipReason}</p>}
          <Link href={`/riprogramma?seduta=${w.id}`} className="inline-flex min-h-11 items-center self-start rounded-xl bg-fg px-4 text-sm font-semibold text-bg">Vuoi recuperarla? Chiedi al coach</Link>
          {!demo && (
            <form action={unskipWorkout}>
              <input type="hidden" name="id" value={w.id} />
              <button className="min-h-11 rounded-xl border border-line px-4 text-sm font-semibold hover:border-faint">Annulla: non l&apos;ho saltata</button>
            </form>
          )}
        </Card>
      )}

      {w.status === "programmato" && w.date >= today && (
        <Link href={`/riprogramma?seduta=${w.id}`} className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-warn/40 bg-warn/5 px-4 text-sm font-semibold text-warn">
          Ho un imprevisto con questa seduta <span aria-hidden>→</span>
        </Link>
      )}

      {w.status === "programmato" && (
        <section className="flex flex-col gap-3">
          <SectionTitle>Registra la seduta</SectionTitle>
          <details open={w.date <= today} className="rounded-[var(--radius-card)] border border-ok/40 bg-surface p-4 sm:p-5">
            <summary className="flex min-h-10 cursor-pointer items-center gap-2 font-semibold text-ok">
              <CheckCircle2 className="size-5" aria-hidden /> L&apos;ho fatta
            </summary>
            <div className="mt-4">
              <ActivityForm
                plannedId={w.id}
                defaults={{ date: w.date <= today ? w.date : today, sport: w.sport, durationMin: w.durationMin, distanceKm: w.distanceKm }}
                sports={athlete.sports.map((s) => s.sport)}
                today={today}
                demo={demo}
              />
            </div>
          </details>
          {!demo && (
            <details className="rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-5">
              <summary className="min-h-10 cursor-pointer font-semibold text-muted">Non l&apos;ho fatta</summary>
              <div className="mt-4"><SkipForm id={w.id} /></div>
            </details>
          )}
        </section>
      )}
    </article>
  );
}
