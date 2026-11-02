import { CalendarView } from "@/components/calendar-view";
import { PageHeader } from "@/components/ui";
import { getAppData } from "@/lib/data/repository";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const { plan, events, today } = await getAppData();
  return (
    <>
      <PageHeader title="Calendario" subtitle="Il tuo programma giorno per giorno. Tocca una seduta per i dettagli." />
      <CalendarView plan={plan} events={events} today={today} />
    </>
  );
}
