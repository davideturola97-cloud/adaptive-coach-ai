import { ShieldCheck, ShieldAlert } from "lucide-react";
import { Card, OriginTag, PageHeader, SectionTitle, SportBadge } from "@/components/ui";
import { formatDayMonth } from "@/lib/dates";
import { SPORT_KEYS } from "@/lib/domain/sports";
import type { ValueOrigin } from "@/lib/domain/types";
import { getAppData } from "@/lib/data/repository";
import { formatPace, formatSwimPace } from "@/lib/training/formulas";
import { TESTS_BY_SPORT, TEST_CATALOG } from "@/lib/training/tests";
import { AddTestForm, ReadinessForm, ResultForm, TestCard } from "./test-cards";

export const dynamic = "force-dynamic";

function Param({ label, value, origin, date }: { label: string; value?: string; origin?: ValueOrigin; date?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-3 last:border-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-right text-sm font-medium">
        {value ? (
          <>
            <span className="flex items-center justify-end gap-2 tabular-nums">{value} {origin && <OriginTag origin={origin} />}</span>
            {date && <span className="block text-xs text-muted">dal {formatDayMonth(date, false)}</span>}
          </>
        ) : (
          <span className="text-muted">Nessun dato: si lavora a sensazione (RPE)</span>
        )}
      </dd>
    </div>
  );
}

export default async function TestPage({ searchParams }: { searchParams: Promise<{ benvenuto?: string }> }) {
  const { benvenuto } = await searchParams;
  const { athlete: a, plannedTests, tests, readiness, today, mode } = await getAppData();
  const demo = mode === "demo";
  const practiced = SPORT_KEYS.filter((s) => a.sports.some((x) => x.sport === s));
  const open = plannedTests.filter((t) => t.status !== "completato");
  const maximalBlocked = !readiness || (readiness.flagged && !readiness.doctorCleared);
  const testable = practiced.filter((s) => TESTS_BY_SPORT[s]);
  const withoutOpen = testable.filter((s) => !open.some((t) => t.sport === s));

  return (
    <>
      <PageHeader title="Test e parametri" subtitle="I test servono a calcolare ritmi, potenze e zone. Puoi rimandarli: il programma va avanti lo stesso." />

      <div className="flex flex-col gap-6">
        {benvenuto && (
          <Card className="border-ok/40 bg-ok/5">
            <p className="font-semibold">Profilo pronto!</p>
            <p className="mt-1 text-sm text-muted">Ecco i test che ti consiglio per partire. Se hai già un risultato recente, inseriscilo e salti il test.</p>
          </Card>
        )}

        <section>
          <SectionTitle>Prima dei test a tutta</SectionTitle>
          {maximalBlocked ? (
            <Card className="flex flex-col gap-4 border-warn/40">
              <p className="flex items-start gap-2 text-sm">
                <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warn" aria-hidden />
                {readiness?.flagged
                  ? "Hai segnalato un possibile problema di salute. Prima di uno sforzo massimale parlane con un medico. Intanto puoi inserire risultati recenti o allenarti a sensazione."
                  : "Rispondi a queste domande prima di programmare un test a tutta. Non sono una visita medica, ma aiutano a capire quando è meglio sentire un medico."}
              </p>
              <ReadinessForm flagged={Boolean(readiness?.flagged)} demo={demo} />
            </Card>
          ) : (
            <Card className="flex items-center gap-3 text-sm">
              <ShieldCheck className="size-5 shrink-0 text-ok" aria-hidden />
              <span>Controllo di sicurezza fatto il {formatDayMonth(readiness!.date, false)}{readiness!.doctorCleared ? ", con via libera del medico" : ""}. Se qualcosa cambia nella tua salute, aggiornalo prima di un test.</span>
            </Card>
          )}
        </section>

        <section>
          <SectionTitle hint={`${open.length} da fare`}>Test consigliati</SectionTitle>
          {open.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {open.map((t) => <TestCard key={t.id} t={t} today={today} maximalBlocked={maximalBlocked} demo={demo} />)}
            </div>
          ) : (
            <Card className="text-sm text-muted">Nessun test in sospeso. Il coach te ne proporrà uno quando i parametri diventeranno vecchi o vedrà dei miglioramenti.</Card>
          )}
        </section>

        {withoutOpen.length > 0 && (
          <section className="flex flex-col gap-3">
            <SectionTitle>Hai già un risultato?</SectionTitle>
            {withoutOpen.map((s) => (
              <details key={s} className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
                <summary className="flex min-h-8 cursor-pointer items-center gap-3"><SportBadge sport={s} /> <span className="text-sm font-semibold">Inserisci un risultato</span></summary>
                <div className="mt-3"><ResultForm sport={s} initialKind={TESTS_BY_SPORT[s]![TESTS_BY_SPORT[s]!.length - 1]} today={today} disabled={demo} /></div>
              </details>
            ))}
            <AddTestForm sports={withoutOpen} demo={demo} />
          </section>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <section>
            <SectionTitle>Parametri attuali</SectionTitle>
            <Card>
              <dl>
                {practiced.includes("run") && <Param label="Ritmo di soglia corsa" value={a.thresholdPaceSecPerKm && formatPace(a.thresholdPaceSecPerKm.value)} origin={a.thresholdPaceSecPerKm?.origin} date={a.thresholdPaceSecPerKm?.date} />}
                {practiced.includes("bike") && <Param label="FTP" value={a.ftpW && `${a.ftpW.value} W`} origin={a.ftpW?.origin} date={a.ftpW?.date} />}
                {practiced.includes("swim") && <Param label="Ritmo CSS nuoto" value={a.cssPaceSecPer100m && formatSwimPace(a.cssPaceSecPer100m.value)} origin={a.cssPaceSecPer100m?.origin} date={a.cssPaceSecPer100m?.date} />}
                {!testable.length && <p className="py-2 text-sm text-muted">Per la palestra non servono test: i carichi si regolano con l&apos;RPE.</p>}
              </dl>
            </Card>
            <p className="mt-2 text-xs text-muted">Formule e limiti delle stime sono spiegati nel file docs/FORMULE.md del progetto.</p>
          </section>

          <section>
            <SectionTitle>Storico dei test</SectionTitle>
            <Card className="flex flex-col divide-y divide-line p-0 sm:p-0">
              {tests.length ? [...tests].reverse().map((t) => (
                <div key={t.id} className="flex flex-col gap-1 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <SportBadge sport={t.sport} />
                    <span className="text-xs text-muted">{formatDayMonth(t.date, false)}</span>
                  </div>
                  <p className="text-sm font-medium">{TEST_CATALOG[t.kind]?.label ?? t.kind}: {t.rawValue}</p>
                  <p className="text-xs text-muted">{t.derived.slice(0, 2).map((d) => `${d.label} ${d.value}`).join(" · ")}</p>
                </div>
              )) : <p className="px-4 py-3 text-sm text-muted">Ancora nessun test registrato.</p>}
            </Card>
          </section>
        </div>
      </div>
    </>
  );
}
