import { Camera, PencilLine } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { WorkoutList, type HistoryItem } from "@/components/workout-list";
import { getAppData } from "@/lib/data/repository";
import { StravaImport } from "@/components/strava";
import { waitingFeedback } from "@/lib/training/waiting";
import { stravaStatus } from "@/lib/strava/service";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function WorkoutsPage() {
  const { plan, today, activities, mode } = await getAppData();
  const strava = mode === "demo" ? null : await stravaStatus((await getUser()).supabase);
  // Attività importate che aspettano lo sforzo percepito: senza RPE il coach non può valutare il carico.
  const waiting = waitingFeedback(activities, today);
  // Storico: attività svolte (con o senza seduta), sedute saltate e sedute passate ancora da registrare.
  const linked = new Set(plan.map((p) => p.completedActivityId).filter(Boolean));
  const history: HistoryItem[] = [
    ...activities.map((a) => {
      const p = plan.find((x) => x.completedActivityId === a.id);
      return { key: `a-${a.id}`, date: a.date, sport: a.sport, title: a.title || p?.title || "Attività", href: p ? `/allenamenti/${p.id}` : `/attivita/${a.id}`, durationMin: a.durationMin, rpe: a.feedback?.rpe, status: linked.has(a.id) ? ("fatta" as const) : ("extra" as const) };
    }),
    ...plan
      .filter((p) => p.date < today && (p.status === "saltato" || p.status === "programmato"))
      .map((p) => ({ key: `p-${p.id}`, date: p.date, sport: p.sport, title: p.title, href: `/allenamenti/${p.id}`, durationMin: p.durationMin, status: p.status === "saltato" ? ("saltata" as const) : ("da registrare" as const) })),
  ].sort((x, y) => y.date.localeCompare(x.date));
  return (
    <>
      <PageHeader title="Allenamenti" subtitle="Sedute in programma e storico delle attività." />
      <div className="mb-6 grid grid-cols-2 gap-3">
        <Link href="/allenamenti/nuova?screenshot=1" className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-line bg-surface text-sm font-semibold hover:border-faint">
          <Camera className="size-5" aria-hidden /> Carica screenshot
        </Link>
        <Link href="/allenamenti/nuova" className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-line bg-surface text-sm font-semibold hover:border-faint">
          <PencilLine className="size-5" aria-hidden /> Inserisci a mano
        </Link>
      </div>
      {strava?.connected && !strava.broken && (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
          <StravaImport compact />
          {waiting.length > 0 && (
            <Link href={`/attivita/${waiting[0].id}`} className="text-sm font-semibold text-warn underline">
              {waiting.length === 1 ? "1 attività da Strava aspetta" : `${waiting.length} attività da Strava aspettano`} il tuo feedback (RPE) →
            </Link>
          )}
        </div>
      )}
      <WorkoutList plan={plan} today={today} history={history} />
    </>
  );
}
