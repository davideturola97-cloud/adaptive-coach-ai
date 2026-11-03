import { TrendingDown, TrendingUp, Trophy } from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import { formatDayMonth } from "@/lib/dates";
import type { RaceEvent } from "@/lib/domain/types";
import { formatPace } from "@/lib/training/formulas";
import { formatRaceTime, type PredictionReport } from "@/lib/training/predictions";
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
          {upcoming.map(({ e, p }) => (
            <p key={e.id} className="flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
              <Trophy className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
              <span>
                <b>{e.name}</b> ({formatDayMonth(e.date, false)}): previsione <b className="num text-base">{formatRaceTime(p!.timeSec)}</b>, a {formatPace(p!.paceSec)}
              </span>
            </p>
          ))}
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
