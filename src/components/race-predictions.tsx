import { TrendingDown, TrendingUp, Trophy } from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import { formatDayMonth } from "@/lib/dates";
import type { RaceEvent } from "@/lib/domain/types";
import { formatPace } from "@/lib/training/formulas";
import { formatRaceTime, raceGoals, type PredictionReport } from "@/lib/training/predictions";
import { daysBetween } from "@/lib/dates";
import { Card, OriginTag, SectionTitle } from "./ui";

const CONF = { alta: "text-ok border-ok/40", media: "text-warn border-warn/40", bassa: "text-bad border-bad/40" } as const;

/** Previsioni dei tempi di gara, con intervallo, affidabilità e da dove vengono. */
export function RacePredictions({ report, events, today }: { report: PredictionReport; events: RaceEvent[]; today: string }) {
  const { predictions } = report;
  // Prossime gare di corsa (o la corsa del triathlon non c'è: si confrontano solo gare singole di corsa).
  const upcoming = events
    .filter((e) => e.date >= today && e.kind === "singolo" && e.sport === "run" && e.distanceKm)
    .map((e) => ({ e, p: predictions.find((p) => Math.abs(p.km - e.distanceKm!) < 0.6) }))
    .filter((x) => x.p)
    .slice(0, 3);

  return (
    <Card className="flex flex-col gap-4">
      <SectionTitle hint={<OriginTag origin="stimato" />}>Previsioni di gara</SectionTitle>
      {predictions.length === 0 ? (
        <p className="text-sm text-muted">{report.notes[0]}</p>
      ) : (
        <>
          {upcoming.map(({ e, p }) => {
            const g = raceGoals(p!, Math.ceil(daysBetween(today, e.date) / 7));
            const goals = [
              { k: "Sicuro", t: g.sicuro, c: "text-ok", d: "anche in una giornata storta" },
              { k: "Possibile", t: g.possibile, c: "text-warn", d: "con una buona giornata" },
              { k: "Ambizioso", t: g.ambizioso, c: "text-run", d: "tutto perfetto" },
            ];
            return (
              <div key={e.id} className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-4">
                <p className="flex items-start gap-2 text-sm">
                  <Trophy className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
                  <span><b>{e.name}</b> · {formatDayMonth(e.date, false)}: tre obiettivi</span>
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {goals.map((x) => (
                    <div key={x.k} className="rounded-xl border border-line p-2 text-center">
                      <p className={clsx("text-xs font-semibold uppercase tracking-wide", x.c)}>{x.k}</p>
                      <p className="num text-xl font-semibold sm:text-2xl">{formatRaceTime(x.t)}</p>
                      <p className="text-[11px] text-muted">{formatPace(x.t / p!.km)}</p>
                      <p className="hidden text-[11px] text-faint sm:block">{x.d}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted">{g.note} Parti al ritmo del &quot;sicuro&quot; nei primi km e decidi strada facendo.</p>
                <Link href={`/gara/${e.id}`} className="self-start text-sm font-semibold text-run underline">Piano gara: passi, tempi di passaggio, gel e checklist</Link>
              </div>
            );
          })}
          <ul className="grid gap-3 sm:grid-cols-2">
            {predictions.map((p) => {
              const d = report.trend?.[p.key];
              return (
                <li key={p.key} className="flex flex-col gap-1 rounded-2xl border border-line p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-muted">{p.label}</span>
                    <span className={clsx("rounded-full border px-2 py-0.5 text-xs font-semibold", CONF[p.confidence])}>affidabilità {p.confidence}</span>
                  </div>
                  <p className="num text-3xl font-semibold">{formatRaceTime(p.timeSec)}</p>
                  <p className="text-xs text-muted">
                    {formatPace(p.paceSec)} · tra {formatRaceTime(p.lowSec)} e {formatRaceTime(p.highSec)}
                  </p>
                  {d !== undefined && Math.abs(d) >= 5 && (
                    <p className={clsx("flex items-center gap-1 text-xs", d < 0 ? "text-ok" : "text-warn")}>
                      {d < 0 ? <TrendingDown className="size-3.5" aria-hidden /> : <TrendingUp className="size-3.5" aria-hidden />}
                      {formatRaceTime(Math.abs(d))} {d < 0 ? "più veloce" : "più lento"} di 4 settimane fa
                    </p>
                  )}
                  <p className="text-xs text-faint">
                    Da:{" "}
                    {p.basedOn.activityId ? <Link href={`/attivita/${p.basedOn.activityId}`} className="underline">{p.basedOn.label}</Link> : p.basedOn.label}
                  </p>
                  {p.notes.map((n) => <p key={n} className="text-xs text-warn">{n}</p>)}
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted">
            Stime dalle corse delle ultime 12 settimane (formula di Riegel, resa più prudente con poco volume o lunghi corti).
            Volume attuale {report.weeklyKm.toLocaleString("it-IT")} km/settimana, lungo più lungo {report.longestKm.toLocaleString("it-IT")} km.
            Si aggiornano a ogni corsa registrata o importata; per previsioni più affidabili segna l&apos;RPE e fai ogni tanto un test o una gara.
          </p>
          {report.notes.map((n) => <p key={n} className="text-xs text-muted">{n}</p>)}
        </>
      )}
    </Card>
  );
}
