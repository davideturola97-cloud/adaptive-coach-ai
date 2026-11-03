import { CalendarView } from "@/components/calendar-view";
import { Camera, History, PencilLine } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { getAppData } from "@/lib/data/repository";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const { plan, events, today, plannedTests } = await getAppData();
  return (
    <>
      <PageHeader
        title="Calendario"
        subtitle="Il tuo programma giorno per giorno. Tocca una seduta per i dettagli."
        action={
          <div className="flex gap-2">
            <Link href="/riprogramma" className="inline-flex min-h-11 items-center rounded-xl border border-warn/50 bg-warn/10 px-4 text-sm font-semibold text-warn">Ho un imprevisto</Link>
            <Link href="/programma" className="inline-flex min-h-11 items-center rounded-xl border border-line bg-surface px-4 text-sm font-semibold hover:border-faint">Programma</Link>
          </div>
        }
      />
      <div className="mb-5 grid grid-cols-3 gap-2">
        <Link href="/allenamenti/nuova" className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl border border-line bg-surface text-xs font-semibold hover:border-faint">
          <PencilLine className="size-5" aria-hidden /> Registra
        </Link>
        <Link href="/allenamenti/nuova?screenshot=1" className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl border border-line bg-surface text-xs font-semibold hover:border-faint">
          <Camera className="size-5" aria-hidden /> Da screenshot
        </Link>
        <Link href="/allenamenti" className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl border border-line bg-surface text-xs font-semibold hover:border-faint">
          <History className="size-5" aria-hidden /> Allenamenti
        </Link>
      </div>
      {!plan.some((p) => p.date >= today) && (
        <Link href="/programma" className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-ok/40 bg-ok/10 px-4 py-3 text-sm text-ok">
          <span>Non hai ancora un programma. Crealo: ci vuole un minuto.</span>
          <span className="font-semibold">Crea</span>
        </Link>
      )}
      <CalendarView plan={plan} events={events} today={today} tests={plannedTests} />
    </>
  );
}
