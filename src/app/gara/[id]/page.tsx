import clsx from "clsx";
import { ArrowLeft, CheckSquare, CupSoda, Flag, Thermometer } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, OriginTag, PageHeader, SectionTitle } from "@/components/ui";
import { daysBetween, formatDayMonth, weekdayName } from "@/lib/dates";
import { getAppData } from "@/lib/data/repository";
import { formatRaceTime, goalVerdict, predictRaces, raceGoals } from "@/lib/training/predictions";
import { RaceGoalForm } from "@/components/race-goal-form";
import { racePlan } from "@/lib/training/race-plan";

export const dynamic = "force-dynamic";

const pace = (s: number) => `${Math.floor(Math.round(s) / 60)}:${String(Math.round(s) % 60).padStart(2, "0")}`;
const GOALS = [
  { key: "mio", label: "Il mio" },
  { key: "sicuro", label: "Sicuro" },
  { key: "possibile", label: "Possibile" },
  { key: "ambizioso", label: "Ambizioso" },
] as const;
type GoalKey = (typeof GOALS)[number]["key"];

export default async function RacePlanPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ obiettivo?: string }> }) {
  const { id } = await params;
  const { obiettivo } = await searchParams;
  const { events, activities, plan, athlete, today, mode } = await getAppData();
  const e = events.find((x) => x.id === id);
  if (!e) notFound();
  const mine = e.goalTimeSec;
  const valid = (k?: string): k is GoalKey => GOALS.some((g) => g.key === k) && (k !== "mio" || Boolean(mine));
  const pick: GoalKey = valid(obiettivo) ? obiettivo : mine ? "mio" : "possibile";
  const run = e.kind === "singolo" && e.sport === "run" && e.distanceKm;
  const pred = run ? predictRaces(activities, plan, athlete, today).predictions.find((p) => Math.abs(p.km - e.distanceKm!) < 0.6) : undefined;
  const goals = pred ? raceGoals(pred, Math.ceil(daysBetween(today, e.date) / 7)) : undefined;
  const timeOf = (k: GoalKey) => (k === "mio" ? mine : goals?.[k]);
  const chosen = timeOf(pick) ?? mine;
  const rp = chosen ? racePlan(e, chosen) : null;
  const verdict = mine && goals ? goalVerdict(mine, goals) : null;
  const shown = GOALS.filter((g) => timeOf(g.key) !== undefined);

  return (
    <article className="flex flex-col gap-6">
      <Link href="/" className="inline-flex min-h-11 w-fit items-center gap-2 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden /> Oggi
      </Link>
      <PageHeader title={`Piano gara: ${e.name}`} subtitle={`${weekdayName(e.date)} ${formatDayMonth(e.date, false)} · ${e.distanceKm ? `${e.distanceKm.toLocaleString("it-IT")} km` : ""} · tra ${daysBetween(today, e.date)} giorni`} />

      {!run ? (
        <Card className="text-sm text-muted">Il piano gara è disponibile per le gare di corsa. Per il triathlon arriverà con la preparazione del Ledroman.</Card>
      ) : !rp ? (
        <Card className="flex flex-col gap-3">
          <p className="text-sm text-muted">Per gli obiettivi calcolati servono corse recenti con distanza e durata. Intanto puoi scrivere il tuo obiettivo: il piano si costruisce su quello.</p>
          <RaceGoalForm eventId={e.id} demo={mode === "demo"} />
        </Card>
      ) : (
        <>
          <section>
            <SectionTitle hint={<OriginTag origin="stimato" />}>Il tuo obiettivo</SectionTitle>
            <div className={clsx("grid gap-2", shown.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3")}>
              {shown.map((g) => (
                <Link
                  key={g.key}
                  href={`/gara/${e.id}?obiettivo=${g.key}`}
                  aria-current={pick === g.key ? "true" : undefined}
                  className={clsx("flex flex-col items-center rounded-2xl border p-3 text-center", pick === g.key ? "border-fg bg-surface-2" : "border-line bg-surface")}
                >
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">{g.label}</span>
                  <span className="num text-2xl font-semibold">{formatRaceTime(timeOf(g.key)!)}</span>
                  <span className="text-xs text-muted">{pace(timeOf(g.key)! / e.distanceKm!)} /km</span>
                </Link>
              ))}
            </div>
            {verdict && (
              <p className={clsx("mt-3 rounded-xl px-3 py-2 text-sm", verdict.level === "molto difficile" ? "bg-bad/10 text-bad" : verdict.level === "ambizioso" ? "bg-warn/10 text-warn" : "bg-ok/10 text-ok")}>{verdict.text}</p>
            )}
            <p className="mt-2 text-xs text-muted">{goals ? `${goals.note} ` : ""}Il piano qui sotto è costruito su &quot;{GOALS.find((g) => g.key === pick)!.label.toLowerCase()}&quot;.</p>
            <div className="mt-4">
              <RaceGoalForm eventId={e.id} current={mine ? formatRaceTime(mine) : undefined} demo={mode === "demo"} />
            </div>
          </section>

          <section>
            <SectionTitle>Come correrla</SectionTitle>
            <Card className="flex flex-col gap-3">
              {rp.segments.map((s) => (
                <div key={s.fromKm} className="flex items-start justify-between gap-3 border-b border-line pb-3 last:border-0 last:pb-0">
                  <div>
                    <p className="font-semibold">Km {Math.round(s.fromKm) + 1}–{Number.isInteger(s.toKm) ? s.toKm : s.toKm.toLocaleString("it-IT", { maximumFractionDigits: 1 })}</p>
                    <p className="text-sm text-muted">{s.label}</p>
                  </div>
                  <p className="num shrink-0 text-2xl font-semibold">{pace(s.paceSec)}<span className="text-sm text-muted"> /km</span></p>
                </div>
              ))}
              <p className="flex gap-2 text-xs text-warn"><Thermometer className="size-4 shrink-0" aria-hidden />{rp.heatNote}</p>
            </Card>
          </section>

          <section>
            <SectionTitle hint="da scrivere sul braccio o sull'orologio">Tempi di passaggio</SectionTitle>
            <Card>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {rp.splits.map((s) => (
                  <div key={s.km} className="text-center">
                    <p className="text-xs text-muted">{s.km === rp.distanceKm ? <Flag className="mx-auto size-4" aria-label="Arrivo" /> : `km ${s.km}`}</p>
                    <p className="num text-xl font-semibold">{formatRaceTime(s.timeSec)}</p>
                  </div>
                ))}
              </div>
            </Card>
          </section>

          <section>
            <SectionTitle>Alimentazione e acqua</SectionTitle>
            <Card>
              <ul className="flex flex-col gap-2 text-sm">{rp.fueling.map((f) => <li key={f} className="flex gap-2"><CupSoda className="mt-0.5 size-4 shrink-0 text-swim" aria-hidden />{f}</li>)}</ul>
            </Card>
          </section>

          {rp.checklist.map((c) => (
            <section key={c.title}>
              <SectionTitle>{c.title}</SectionTitle>
              <Card>
                <ul className="flex flex-col gap-2 text-sm">{c.items.map((i) => <li key={i} className="flex gap-2"><CheckSquare className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />{i}</li>)}</ul>
              </Card>
            </section>
          ))}
        </>
      )}
    </article>
  );
}
