import { HeartPulse, Trash2 } from "lucide-react";
import { deleteActivity } from "@/app/allenamenti/actions";
import { Card, OriginTag } from "@/components/ui";
import type { CompletedActivity } from "@/lib/domain/types";
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
export function ActivitySummary({ a, back, editable }: { a: CompletedActivity; back: string; editable: boolean }) {
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
        <OriginTag origin="misurato" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Item label="Durata" value={formatDuration(a.durationMin)} />
        {a.distanceKm !== undefined && <Item label="Distanza" value={`${a.distanceKm.toLocaleString("it-IT")} km`} />}
        {pace && <Item label={a.sport === "bike" ? "Velocità media" : "Passo medio"} value={pace} />}
        {a.avgHr && <Item label={<span className="flex items-center gap-1"><HeartPulse className="size-3.5" aria-hidden />FC media</span>} value={`${a.avgHr} bpm`} />}
        {a.avgPowerW && <Item label="Potenza media" value={`${a.avgPowerW} W`} />}
        {a.elevationM !== undefined && a.elevationM > 0 && <Item label="Dislivello" value={`${a.elevationM} m`} />}
      </div>
      {f && (
        <div className="flex flex-col gap-2 border-t border-line pt-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Il tuo feedback</p>
          <p>
            <span className="num text-xl font-semibold">RPE {f.rpe}</span>
            <span className="text-muted"> · fatica muscolare {f.muscleFatigue}/5 · fiato {f.cardioFatigue}/5{f.sleepQuality ? ` · sonno ${f.sleepQuality}/5` : ""} · {f.feeling}</span>
          </p>
          {f.pain && <p className="text-warn">Dolore: {f.pain}</p>}
          {f.notes && <p className="text-muted">“{f.notes}”</p>}
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
