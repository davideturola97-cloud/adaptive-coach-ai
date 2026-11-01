import { CalendarView } from "@/components/calendar-view";
import { PageHeader } from "@/components/ui";
import { getData } from "@/lib/demo/store";

export const dynamic = "force-dynamic";

export default function CalendarPage() {
  const { plan, events, today } = getData();
  return (
    <>
      <PageHeader title="Calendario" subtitle="Il tuo programma giorno per giorno. Tocca una seduta per i dettagli." />
      <CalendarView plan={plan} events={events} today={today} />
    </>
  );
}
