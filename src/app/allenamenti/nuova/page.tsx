import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ActivityForm } from "@/components/activity-form";
import { PageHeader } from "@/components/ui";
import { isAiConfigured } from "@/lib/ai/config";
import { getAppData } from "@/lib/data/repository";
import { SPORT_KEYS } from "@/lib/domain/sports";
import { ScreenshotImport } from "./screenshot-import";

export const dynamic = "force-dynamic";

export default async function NewActivityPage({ searchParams }: { searchParams: Promise<{ screenshot?: string }> }) {
  const { screenshot } = await searchParams;
  const { today, athlete, mode, plan, activities } = await getAppData();
  // Solo quello che serve all'analisi della seduta letta dallo screenshot.
  const from = new Date(Date.parse(today) - 90 * 864e5).toISOString().slice(0, 10);
  const context = {
    athlete: { ftpW: athlete.ftpW, thresholdPaceSecPerKm: athlete.thresholdPaceSecPerKm, cssPaceSecPer100m: athlete.cssPaceSecPer100m, weightKg: athlete.weightKg },
    plan: plan.filter((w) => w.date >= from && w.date <= today && w.status === "programmato").map((w) => ({ date: w.date, sport: w.sport, type: w.type, durationMin: w.durationMin, structure: w.structure })),
    history: activities.filter((a) => a.date >= from).map((a) => ({ id: a.id, date: a.date, sport: a.sport, durationMin: a.durationMin, distanceKm: a.distanceKm, avgHr: a.avgHr, avgPowerW: a.avgPowerW, elevationM: a.elevationM })),
  };
  const sports = athlete.sports.length ? athlete.sports.map((s) => s.sport) : SPORT_KEYS;
  const demo = mode === "demo";
  return (
    <>
      <Link href="/allenamenti" className="mb-2 inline-flex min-h-11 items-center gap-2 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden /> Allenamenti
      </Link>
      <PageHeader title="Nuova attività" subtitle="Un allenamento fuori programma, una gara o una seduta da registrare. Se nel programma c'è una seduta dello stesso sport quel giorno, la collego io." />
      <div className="flex flex-col gap-6">
        <ScreenshotImport today={today} sports={sports} enabled={isAiConfigured()} demo={demo} context={context} />
        {!screenshot && (
          <details className="rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-5">
            <summary className="min-h-10 cursor-pointer font-semibold">Oppure inserisci a mano</summary>
            <div className="mt-4"><ActivityForm defaults={{ date: today }} sports={sports} today={today} demo={demo} /></div>
          </details>
        )}
      </div>
    </>
  );
}
