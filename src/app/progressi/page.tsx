import { AdherenceChart, BikeHoursChart, LoadChart, PaceChart, RunKmChart, VolumeChart } from "@/components/charts";
import { Card, OriginTag, PageHeader, SectionTitle, SportBadge } from "@/components/ui";
import { addDays, formatDayMonth } from "@/lib/dates";
import { getAppData } from "@/lib/data/repository";
import { weeklySummaries } from "@/lib/training/analytics";
import { Signals } from "@/components/signals";
import { feedbackSignals } from "@/lib/training/feedback";
import { RacePredictions } from "@/components/race-predictions";
import { predictRaces } from "@/lib/training/predictions";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const { plan, activities, tests, today, athlete, events } = await getAppData();
  const predictions = predictRaces(activities, plan, athlete, today);
  const weeks = weeklySummaries(activities, plan, today, 10);

  const easyTypes = new Set(["corsa_facile", "lungo"]);
  const easyPace = weeks.map((w) => {
    const end = addDays(w.weekStart, 6);
    const acts = plan
      .filter((p) => p.date >= w.weekStart && p.date <= end && easyTypes.has(p.type) && p.completedActivityId)
      .map((p) => activities.find((a) => a.id === p.completedActivityId)!)
      .filter((a) => a.distanceKm);
    const km = acts.reduce((t, a) => t + (a.distanceKm ?? 0), 0);
    const sec = acts.reduce((t, a) => t + a.durationMin * 60, 0);
    return { weekStart: w.weekStart, easyPace: km ? Math.round(sec / km) : null };
  });
  const adherence = weeks.map((w) => ({ weekStart: w.weekStart, adherence: w.planned ? Math.round((w.completed / w.planned) * 100) : null }));
  const feedbacks = activities.filter((a) => a.feedback).slice(-6).reverse();

  return (
    <>
      <PageHeader title="Progressi" subtitle="Ultime 10 settimane. I valori stimati sono sempre segnalati." />

      <div className="flex flex-col gap-6">
        <Signals signals={feedbackSignals(activities, plan, today).filter((s) => s.id !== "registrare")} />
        <RacePredictions report={predictions} events={events} today={today} />
        <Card>
          <SectionTitle hint="ore per settimana">Volume di allenamento</SectionTitle>
          <VolumeChart data={weeks} />
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <SectionTitle hint={<OriginTag origin="misurato" />}>Km di corsa a settimana</SectionTitle>
            <RunKmChart data={weeks} />
          </Card>
          <Card>
            <SectionTitle hint={<OriginTag origin="misurato" />}>Ore di ciclismo a settimana</SectionTitle>
            <BikeHoursChart data={weeks} />
          </Card>
          <Card>
            <SectionTitle hint={<OriginTag origin="stimato" />}>Carico settimanale</SectionTitle>
            <LoadChart data={weeks} />
            <p className="mt-2 text-xs text-muted">Minuti × sforzo percepito (metodo session-RPE di Foster). Un indicatore, non una misura fisiologica.</p>
          </Card>
          <Card>
            <SectionTitle hint="sedute fatte / previste">Aderenza al programma</SectionTitle>
            <AdherenceChart data={adherence} />
          </Card>
        </div>

        <Card>
          <SectionTitle hint="più in alto = più veloce">Ritmo delle corse facili e dei lunghi</SectionTitle>
          <PaceChart data={easyPace} />
          <p className="mt-2 text-xs text-muted">A parità di sforzo, un ritmo più veloce indica una base aerobica migliore.</p>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <section>
            <SectionTitle>Risultati dei test</SectionTitle>
            <div className="flex flex-col gap-3">
              {tests.map((t) => (
                <Card key={t.id} className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <SportBadge sport={t.sport} />
                    <span className="text-xs text-muted">{formatDayMonth(t.date, false)}</span>
                  </div>
                  <p className="font-semibold">{t.rawValue} <OriginTag origin="misurato" /></p>
                  <dl className="flex flex-col gap-1.5 text-sm">
                    {t.derived.map((d) => (
                      <div key={d.label} className="flex items-center justify-between gap-3">
                        <dt className="text-muted">{d.label}</dt>
                        <dd className="flex items-center gap-2 font-semibold tabular-nums">{d.value} <OriginTag origin={d.origin} /></dd>
                      </div>
                    ))}
                  </dl>
                </Card>
              ))}
            </div>
            {athlete.ftpW && <p className="mt-3 text-xs text-muted">L&apos;evoluzione della FTP comparirà come grafico dal secondo test in poi.</p>}
          </section>

          <section>
            <SectionTitle>Ultimi feedback</SectionTitle>
            <Card className="flex flex-col divide-y divide-line p-0 sm:p-0">
              {feedbacks.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-muted">{formatDayMonth(a.date)} · sensazioni {a.feedback!.feeling}</p>
                  </div>
                  <p className="num shrink-0 text-2xl font-semibold">RPE {a.feedback!.rpe}</p>
                </div>
              ))}
            </Card>
          </section>
        </div>
      </div>
    </>
  );
}
