import { CalendarClock, History, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { aiConfig } from "@/lib/ai/config";
import { getAiUsageToday, getAppData, getCoachConversations, getCoachMessages } from "@/lib/data/repository";
import { deleteConversation } from "./actions";
import { CoachChat } from "./coach-chat";

export const dynamic = "force-dynamic";

export default async function CoachPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  const { mode } = await getAppData();
  const cfg = aiConfig();
  const conversations = await getCoachConversations();
  const current = c && conversations.some((x) => x.id === c) ? c : null;
  const messages = current ? await getCoachMessages(current) : [];
  const usage = await getAiUsageToday();
  const demo = mode === "demo";

  return (
    <>
      <PageHeader
        title="Coach AI"
        subtitle="Parla con il coach dei tuoi allenamenti e degli imprevisti. Le modifiche al programma le decidi sempre tu."
        action={
          <Link href="/coach" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-semibold hover:border-faint">
            <Plus className="size-4" aria-hidden /> Nuova
          </Link>
        }
      />

      <div className="flex flex-col gap-5">
        {!cfg && !demo && (
          <Card className="border-warn/40 bg-warn/5 text-sm">
            <p className="font-semibold text-warn">Il coach AI non è ancora attivo</p>
            <p className="mt-1 text-muted">Serve la chiave OpenAI nel file .env.local del computer che fa girare l&apos;app (riga OPENAI_API_KEY). Intanto puoi usare la conversazione guidata.</p>
          </Card>
        )}
        {demo && <Card className="text-sm text-muted">In modalità dimostrativa la chat non è attiva: accedi con il tuo account.</Card>}

        <CoachChat key={current ?? "nuova"} conversationId={current} initial={messages} enabled={Boolean(cfg)} demo={demo} />

        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/riprogramma" className="block">
            <Card className="flex h-full items-center gap-3 transition-colors hover:border-faint">
              <CalendarClock className="size-5 shrink-0 text-warn" aria-hidden />
              <div>
                <p className="font-semibold">Conversazione guidata</p>
                <p className="text-sm text-muted">Gli imprevisti con domande a pulsanti, senza scrivere.</p>
              </div>
            </Card>
          </Link>
          <Link href="/programma/storico" className="block">
            <Card className="flex h-full items-center gap-3 transition-colors hover:border-faint">
              <History className="size-5 shrink-0 text-muted" aria-hidden />
              <div>
                <p className="font-semibold">Storico delle modifiche</p>
                <p className="text-sm text-muted">Tutte le versioni del programma; l&apos;ultima si annulla.</p>
              </div>
            </Card>
          </Link>
        </div>

        {conversations.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Conversazioni</h2>
            {conversations.map((x) => (
              <div key={x.id} className="flex items-center gap-2">
                <Link href={`/coach?c=${x.id}`} className={`min-h-11 flex-1 truncate rounded-xl border px-4 py-2.5 text-sm ${x.id === current ? "border-fg" : "border-line hover:border-faint"}`}>
                  {x.title || "Conversazione"}
                </Link>
                <form action={async () => { "use server"; await deleteConversation(x.id); }}>
                  <button aria-label="Elimina conversazione" className="grid size-11 place-items-center rounded-xl text-muted hover:bg-bad/10 hover:text-bad"><Trash2 className="size-4" /></button>
                </form>
              </div>
            ))}
          </section>
        )}

        {usage && cfg && (
          <p className="text-xs text-faint">
            Uso di oggi: {usage.requests} di {cfg.limits.requests} richieste · {usage.images} di {cfg.limits.images} screenshot. I consigli del coach non sostituiscono il parere di un medico.
          </p>
        )}
      </div>
    </>
  );
}
