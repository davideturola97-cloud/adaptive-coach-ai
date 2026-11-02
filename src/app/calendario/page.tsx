import { CalendarView } from "@/components/calendar-view";
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
