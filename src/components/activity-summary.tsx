import { HeartPulse, Trash2 } from "lucide-react";
import { deleteActivity } from "@/app/allenamenti/actions";
import { Card, OriginTag } from "@/components/ui";
import type { CompletedActivity } from "@/lib/domain/types";
import { SplitsView } from "./splits-view";
import { ActivityAnalysisCard } from "./activity-analysis";
import { AddFeedbackForm, STRAVA_ORANGE } from "./strava";
import type { ActivityData, AthleteData, PlannedData } from "@/lib/training/analysis";
import { formatDuration, formatPace, formatSwimPace } from "@/lib/training/formulas";

function Item({ label, value }: { label: React.ReactNode; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="num text-2xl font-semibold">{value}</p>
    </div>
  );
}

/** Dati misurati di un'attività e il feedback dell'atleta, con la possibilità di cancellarla. */
export function ActivitySummary({ a, back, editable, planned, athlete, history }: { a: CompletedActivity; back: string; editable: boolean; planned?: PlannedData; athlete?: AthleteData; history?: ActivityData[] }) {
  const pace =
    a.distanceKm && a.distanceKm > 0
      ? a.sport === "run"
        ? formatPace((a.durationMin * 60) / a.distanceKm)
        : a.sport === "swim"
          ? formatSwimPace((a.durationMin * 60) / (a.distanceKm * 10))
          : a.sport === "bike"
            ? `${((a.distanceKm / a.durationMin) * 60).toFixed(1).replace(".", ",")} km/h`
            : undefined
      : undefined;
  const f = a.feedback;
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Attività svolta</p>
        <span className="flex items-center gap-3">
          {a.externalId?.startsWith("strava:") && (
            <a href={`https://www.strava.com/activities/${a.externalId.slice(7)}`} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold underline" style={{ color: STRAVA_ORANGE }}>
              Vedi su Strava
            </a>
          )}
          <OriginTag origin="misurato" />
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Item label="Durata" value={formatDuration(a.durationMin)} />
        {a.distanceKm !== undefined && <Item label="Distanza" value={a.sport === "swim" ? `${Math.round(a.distanceKm * 1000)} m` : `${a.distanceKm.toLocaleString("it-IT")} km`} />}
        {pace && <Item label={a.sport === "bike" ? "Velocità media" : "Passo medio"} value={pace} />}
        {a.avgHr && <Item label={<span className="flex items-center gap-1"><HeartPulse className="size-3.5" aria-hidden />FC media</span>} value={`${a.avgHr} bpm`} />}
        {a.avgPowerW && <Item label="Potenza media" value={`${a.avgPowerW} W`} />}
        {a.elevationM !== undefined && a.elevationM > 0 && <Item label="Dislivello" value={`${a.elevationM} m`} />}
      </div>
      {a.gymLog?.length ? (
        <div className="flex flex-col gap-1 border-t border-line pt-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Esercizi</p>
          <ul className="flex flex-col">
            {a.gymLog.map((e, i) => (
              <li key={i} className="flex justify-between gap-3 border-b border-line py-1.5 last:border-0">
                <span>{e.name}</span>
                <span className="num text-right">
                  {e.sets} × {e.reps}{e.loadKg ? ` · ${String(e.loadKg).replace(".", ",")} kg` : ""}
                  {!e.done && <span className="text-warn"> · non tutte riuscite</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {a.sport !== "gym" && <ActivityAnalysisCard a={a} planned={planned} athlete={athlete} history={history} />}
      {a.splits?.length ? <div className="border-t border-line pt-3"><SplitsView splits={a.splits} sport={a.sport} planned={planned} athlete={athlete} /></div> : null}
      {f && (
        <div className="flex flex-col gap-2 border-t border-line pt-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Il tuo feedback</p>
          <p>
            <span className="num text-xl font-semibold">RPE {f.rpe}</span>
            <span className="text-muted">{[f.muscleFatigue && `fatica muscolare ${f.muscleFatigue}/5`, f.cardioFatigue && `fiato ${f.cardioFatigue}/5`, f.sleepQuality && `sonno ${f.sleepQuality}/5`, f.feeling].filter(Boolean).map((x) => ` · ${x}`).join("")}</span>
          </p>
          {f.pain && <p className="text-warn">Dolore: {f.pain}</p>}
          {f.notes && <p className="text-muted">“{f.notes}”</p>}
        </div>
      )}
      {!f && editable && (
        <div className="flex flex-col gap-3 border-t border-line pt-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-warn">Com&apos;è andata? Manca il tuo feedback</p>
          <AddFeedbackForm activityId={a.id} />
        </div>
      )}
      {editable && (
        <form action={deleteActivity} className="border-t border-line pt-3">
          <input type="hidden" name="id" value={a.id} />
          <input type="hidden" name="back" value={back} />
          <button className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-bad hover:bg-bad/10">
            <Trash2 className="size-4" aria-hidden /> Cancella attività
          </button>
        </form>
      )}
    </Card>
  );
}
