import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { formatDayMonth } from "@/lib/dates";
import { getAppData } from "@/lib/data/repository";
import { ClearPlan } from "./clear-plan";
import { PlanBuilder } from "./plan-builder";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const { plan, today, mode, athlete, events } = await getAppData();
  const future = plan.filter((p) => p.date >= today && p.status === "programmato");
  const lastDate = future.at(-1)?.date;

  return (
    <>
      <PageHeader title="Programma" subtitle="Il coach costruisce le settimane attorno alle tue gare, ai giorni disponibili e ai lunghi nel weekend." />
      <div className="flex flex-col gap-5">
        {future.length > 0 && (
          <Card className="flex flex-col gap-3 text-sm">
            <p>
              Programma attuale: <span className="font-semibold">{future.length} sedute</span> fino al {lastDate && formatDayMonth(lastDate, false)}. <Link href="/calendario" className="font-semibold underline">Vedi il calendario</Link>.
            </p>
            <p className="text-muted">Per sostituirlo crea una nuova anteprima qui sotto e premi <span className="font-semibold text-fg">Conferma e salva</span>: le sedute future vengono rimpiazzate.</p>
            {mode === "utente" && <ClearPlan />}
          </Card>
        )}
        {mode === "utente" && !events.some((e) => e.date >= today) && (
          <Card className="text-sm text-muted">Non hai gare in programma: il coach costruirà un programma di forma generale. <Link href="/profilo/gare" className="font-semibold text-fg underline">Aggiungi una gara</Link></Card>
        )}
        {mode === "utente" && !athlete.longDays.length && (
          <Card className="text-sm text-muted">Non hai scelto i giorni per i lunghi: userò sabato e domenica. <Link href="/profilo/modifica" className="font-semibold text-fg underline">Cambia nel profilo</Link></Card>
        )}
        <PlanBuilder demo={mode === "demo"} hasPlan={future.length > 0} />
        <p className="text-xs text-muted">Il programma usa regole fisse: una settimana di scarico ogni quattro, mai due sedute dure di fila, scarico prima delle gare A e recupero dopo. Le intensità sono in RPE finché non hai test; poi compaiono ritmi e watt stimati.</p>
      </div>
    </>
  );
}
