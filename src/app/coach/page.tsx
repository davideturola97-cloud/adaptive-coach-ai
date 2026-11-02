import { Bot, CalendarClock, History, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";

export default function CoachPage() {
  return (
    <>
      <PageHeader title="Coach AI" subtitle="Il tuo allenatore: ti aiuta a riorganizzare la settimana quando la vita si mette in mezzo." />

      <div className="flex flex-col gap-4">
        <Link href="/riprogramma" className="block">
          <Card className="flex items-start gap-4 border-warn/40 transition-colors hover:border-warn">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-run to-bike"><CalendarClock className="size-5 text-white" aria-hidden /></span>
            <div>
              <p className="text-lg font-semibold">Ho un imprevisto</p>
              <p className="mt-1 text-sm text-muted">
                Una cena di lavoro, poco tempo, stanchezza, un dolore, un viaggio. Rispondi a qualche domanda e scegli tra le soluzioni del coach:
                vedi sempre il programma prima e dopo, il perché e i compromessi.
              </p>
            </div>
          </Card>
        </Link>

        <Link href="/programma/storico" className="block">
          <Card className="flex items-center gap-4 transition-colors hover:border-faint">
            <History className="size-5 shrink-0 text-muted" aria-hidden />
            <div>
              <p className="font-semibold">Storico delle modifiche</p>
              <p className="text-sm text-muted">Ogni cambiamento al programma resta salvato e l&apos;ultimo si può annullare.</p>
            </div>
          </Card>
        </Link>

        <Card className="flex items-start gap-4 border-estimate/40 bg-estimate/5">
          <MessageSquareText className="mt-0.5 size-5 shrink-0 text-estimate" aria-hidden />
          <div className="text-sm">
            <p className="font-semibold text-estimate">Chat libera con l&apos;intelligenza artificiale: in arrivo</p>
            <p className="mt-1 text-muted">
              Nella prossima versione potrai scrivere o dire al coach cosa succede, per esempio &quot;martedì ho una cena di lavoro e non posso fare le ripetute&quot;.
              Il coach ragionerà con te e userà le stesse regole di sicurezza di oggi. Non cambierà mai il programma senza la tua conferma.
            </p>
          </div>
        </Card>

        <p className="flex items-center gap-2 text-xs text-faint">
          <Bot className="size-4" aria-hidden /> I consigli del coach riguardano l&apos;allenamento e non sostituiscono il parere di un medico.
        </p>
      </div>
    </>
  );
}
