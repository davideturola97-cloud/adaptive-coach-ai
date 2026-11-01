import { ArrowLeft, HeartPulse, ShieldAlert, Lightbulb } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, OriginTag, SectionTitle, SportBadge, StatusLabel } from "@/components/ui";
import { formatDayMonth, weekdayName } from "@/lib/dates";
import { WORKOUT_TYPE_LABEL } from "@/lib/domain/sports";
import type { WorkoutStep } from "@/lib/domain/types";
import { getData } from "@/lib/demo/store";
import { formatDuration } from "@/lib/training/formulas";

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

export default async function WorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { plan, activities } = getData();
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
        L&apos;intensità è indicata con la scala RPE da 1 a 10 (sforzo percepito). Ritmi e potenze precise compariranno solo quando ci saranno test affidabili.
      </Card>

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
            {w.structure.recoveries && <p className="mt-2 rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">Recuperi: {w.structure.recoveries}</p>}
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

      {done && (
        <section>
          <SectionTitle hint="dati dimostrativi">Attività svolta</SectionTitle>
          <Card className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div><p className="text-xs text-muted">Durata</p><p className="num text-2xl font-semibold">{formatDuration(done.durationMin)}</p></div>
            {done.distanceKm !== undefined && <div><p className="text-xs text-muted">Distanza</p><p className="num text-2xl font-semibold">{done.distanceKm.toLocaleString("it-IT")} km</p></div>}
            {done.avgHr && <div><p className="flex items-center gap-1 text-xs text-muted"><HeartPulse className="size-3.5" aria-hidden />FC media</p><p className="num text-2xl font-semibold">{done.avgHr} bpm</p></div>}
            {done.avgPowerW && <div><p className="text-xs text-muted">Potenza media</p><p className="num text-2xl font-semibold">{done.avgPowerW} W</p></div>}
            {done.feedback && (
              <div className="col-span-2 border-t border-line pt-3 sm:col-span-4">
                <p className="text-xs text-muted">Il tuo feedback</p>
                <p className="mt-1 text-sm">RPE {done.feedback.rpe}/10 · fatica muscolare {done.feedback.muscleFatigue}/5 · fatica cardio {done.feedback.cardioFatigue}/5 · sensazioni: {done.feedback.feeling}</p>
              </div>
            )}
          </Card>
        </section>
      )}
    </article>
  );
}
