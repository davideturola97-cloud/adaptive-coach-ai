import { ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import { eventDescription } from "@/components/event-summary";
import { Card, PageHeader, SectionTitle } from "@/components/ui";
import { daysBetween } from "@/lib/dates";
import { getAppData } from "@/lib/data/repository";
import { deleteEvent } from "./actions";
import { AddEventForm } from "./add-event-form";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const { events, today, mode } = await getAppData();
  const demo = mode === "demo";
  const upcoming = events.filter((e) => e.date >= today);
  const past = events.filter((e) => e.date < today);

  return (
    <>
      <Link href="/profilo" className="mb-2 inline-flex min-h-11 items-center gap-2 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden /> Profilo
      </Link>
      <PageHeader title="Le tue gare" subtitle="Il programma si organizza attorno alle gare A; le B e le C sono tappe intermedie." />

      <div className="flex flex-col gap-6">
        <section>
          <SectionTitle>In programma</SectionTitle>
          <div className="flex flex-col gap-2">
            {upcoming.length ? upcoming.map((e) => (
              <Card key={e.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold"><span className="mr-2 rounded-md border border-line px-1.5 text-xs text-muted">{e.priority}</span>{e.name}</p>
                  <p className="text-sm text-muted">{eventDescription(e)} · tra {daysBetween(today, e.date)} giorni</p>
                </div>
                {!demo && (
                  <form action={deleteEvent}>
                    <input type="hidden" name="id" value={e.id} />
                    <button aria-label={`Elimina ${e.name}`} className="grid size-11 place-items-center rounded-xl text-muted hover:bg-bad/10 hover:text-bad"><Trash2 className="size-5" /></button>
                  </form>
                )}
              </Card>
            )) : <Card className="text-sm text-muted">Nessuna gara in programma.</Card>}
          </div>
        </section>

        <section>
          <SectionTitle>Aggiungi una gara</SectionTitle>
          <AddEventForm disabled={demo} />
        </section>

        {past.length > 0 && (
          <section>
            <SectionTitle>Gare passate</SectionTitle>
            <div className="flex flex-col gap-2">
              {past.map((e) => <Card key={e.id} className="text-sm"><span className="font-semibold">{e.name}</span> <span className="text-muted">· {eventDescription(e)}</span></Card>)}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
