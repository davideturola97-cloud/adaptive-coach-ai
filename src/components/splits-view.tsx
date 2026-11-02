import { SPORTS } from "@/lib/domain/sports";
import type { AthleteProfile, PlannedWorkout, Split, Sport } from "@/lib/domain/types";
import { analyzeSplits, formatSplitPace } from "@/lib/training/splits";

/** Intertempi km per km (barra più lunga = più veloce) con la valutazione automatica. */
export function SplitsView({ splits, sport, planned, athlete }: { splits: Split[]; sport: Sport; planned?: Pick<PlannedWorkout, "type">; athlete?: Pick<AthleteProfile, "thresholdPaceSecPerKm"> }) {
  const paces = splits.map((s) => s.paceSec).filter((p): p is number => Boolean(p));
  if (!paces.length) return null;
  const slow = Math.max(...paces);
  const fast = Math.min(...paces);
  const span = Math.max(1, slow - fast);
  const a = analyzeSplits(splits, sport, planned, athlete);
  const hasHr = splits.some((s) => s.hr);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Intertempi</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="py-1 pr-2 font-medium">{sport === "swim" ? "Tratto" : "Km"}</th>
              <th className="w-full py-1 pr-2 font-medium">Passo</th>
              {hasHr && <th className="py-1 text-right font-medium">FC</th>}
            </tr>
          </thead>
          <tbody>
            {splits.map((s) => (
              <tr key={s.n} className={s === a.fastest ? "text-ok" : s === a.slowest ? "text-warn" : undefined}>
                <td className="py-1 pr-2">{s.km < 0.9 && sport !== "swim" ? `${s.n} (${s.km.toLocaleString("it-IT")})` : s.n}</td>
                <td className="py-1 pr-2">
                  {s.paceSec ? (
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 rounded-full" style={{ width: `${30 + ((slow - s.paceSec) / span) * 70}%`, background: SPORTS[sport].colorVar, opacity: s.km < 0.9 ? 0.4 : 1 }} />
                      <span className="shrink-0">{formatSplitPace(sport, s.paceSec)}</span>
                    </span>
                  ) : (
                    <span className="text-faint">non leggibile</span>
                  )}
                </td>
                {hasHr && <td className="py-1 text-right">{s.hr ?? "–"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {a.findings.length > 0 && (
        <div className="rounded-xl bg-surface-2 p-3 text-sm">
          <p className="font-semibold">Valutazione</p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-muted">{a.findings.map((f) => <li key={f}>{f}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
