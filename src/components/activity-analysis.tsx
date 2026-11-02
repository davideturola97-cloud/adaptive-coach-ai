import { Sparkles } from "lucide-react";
import { analyzeActivity, type ActivityData, type AthleteData, type PlannedData } from "@/lib/training/analysis";

/** Analisi della seduta, per ogni sport: riepilogo, confronto con il programma, con i test e con le uscite precedenti. */
export function ActivityAnalysisCard({ a, planned, athlete, history }: { a: ActivityData; planned?: PlannedData; athlete?: AthleteData; history?: ActivityData[] }) {
  const { headline, findings } = analyzeActivity(a, { planned, athlete, history });
  if (!findings.length) return null;
  return (
    <div className="rounded-xl bg-surface-2 p-3 text-sm">
      <p className="flex items-center gap-2 font-semibold"><Sparkles className="size-4 text-warn" aria-hidden /> Analisi dell&apos;allenamento</p>
      <p className="mt-1 text-muted">{headline}.</p>
      <ul className="mt-2 list-disc space-y-1 pl-4 text-muted">{findings.map((f) => <li key={f}>{f}</li>)}</ul>
      <p className="mt-2 text-xs text-faint">Calcoli con regole fisse sui tuoi dati; i valori legati ai test sono stime.</p>
    </div>
  );
}
