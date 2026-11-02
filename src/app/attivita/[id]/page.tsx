import { ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivitySummary } from "@/components/activity-summary";
import { PageHeader, SportBadge } from "@/components/ui";
import { formatDayMonth, weekdayName } from "@/lib/dates";
import { getAppData } from "@/lib/data/repository";

export const dynamic = "force-dynamic";

export default async function ActivityPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ salvato?: string }> }) {
  const { id } = await params;
  const { salvato } = await searchParams;
  const { activities, plan, mode, athlete } = await getAppData();
  const a = activities.find((x) => x.id === id);
  if (!a) notFound();
  const planned = plan.find((p) => p.completedActivityId === a.id);

  return (
    <div className="flex flex-col gap-5">
      <Link href="/allenamenti" className="inline-flex min-h-11 w-fit items-center gap-2 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden /> Allenamenti
      </Link>
      <div className="flex flex-col gap-2">
        <SportBadge sport={a.sport} />
        <PageHeader title={a.title || "Attività"} subtitle={`${weekdayName(a.date)} ${formatDayMonth(a.date, false)} · ${planned ? "dal programma" : "fuori programma"}`} />
      </div>
      {salvato && (
        <p role="status" className="flex items-center gap-2 rounded-xl border border-ok/40 bg-ok/10 px-4 py-3 text-sm text-ok">
          <CheckCircle2 className="size-5" aria-hidden /> Attività salvata.
        </p>
      )}
      {planned && <Link href={`/allenamenti/${planned.id}`} className="text-sm font-semibold underline">Vedi la seduta del programma</Link>}
      <ActivitySummary a={a} back="/allenamenti" editable={mode === "utente"} planned={planned} athlete={athlete} history={activities} />
    </div>
  );
}
