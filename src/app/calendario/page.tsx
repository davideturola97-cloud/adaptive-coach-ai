import { CalendarView } from "@/components/calendar-view";
import { PageHeader } from "@/components/ui";
import { getAppData } from "@/lib/data/repository";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const { plan, events, today, plannedTests } = await getAppData();
  return (
    <>
      <PageHeader title="Calendario" subtitle="Il tuo programma giorno per giorno. Tocca una seduta per i dettagli." />
      {!plan.length && (
        <p className="mb-5 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-muted">
          Il programma di allenamento non è ancora stato generato: arriva con il prossimo aggiornamento. Qui vedi già gare e test.
        </p>
      )}
      <CalendarView plan={plan} events={events} today={today} tests={plannedTests} />
    </>
  );
}
