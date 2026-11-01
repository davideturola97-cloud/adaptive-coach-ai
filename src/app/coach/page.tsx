import { ArrowRight, Bot, Mic, SendHorizontal } from "lucide-react";
import { Card, PageHeader, SectionTitle } from "@/components/ui";

/**
 * Anteprima statica della chat e della riprogrammazione.
 * Nessuna chiamata AI: la logica vera arriva con le Milestone 6 (regole) e 7 (AI).
 */
const MESSAGES = [
  { from: "user", text: "Martedì ho una cena di lavoro e non posso fare le ripetute." },
  {
    from: "coach",
    text: "Nessun problema. Ti propongo di spostare le ripetute a giovedì e di trasformare la corsa facile di giovedì in una pedalata di recupero venerdì. Così non metti due sedute intense una dopo l'altra. Vuoi vedere il confronto?",
  },
] as const;

const ORIGINAL = [
  ["Mar", "Ripetute 6 × 3'", "run"],
  ["Mer", "Endurance 75'", "bike"],
  ["Gio", "Corsa facile 45'", "run"],
  ["Ven", "Recupero bici 45'", "bike"],
] as const;
const PROPOSED = [
  ["Mar", "Riposo (cena di lavoro)", null],
  ["Mer", "Endurance 75'", "bike"],
  ["Gio", "Ripetute 6 × 3'", "run"],
  ["Ven", "Corsa facile 35'", "run"],
] as const;

function PlanList({ rows }: { rows: readonly (readonly [string, string, "run" | "bike" | null])[] }) {
  return (
    <ul className="flex flex-col gap-1.5 text-sm">
      {rows.map(([d, t, s]) => (
        <li key={d} className="flex items-center gap-3">
          <span className="w-8 text-xs font-semibold text-muted">{d}</span>
          <span className={s === "run" ? "h-4 w-1 rounded bg-run" : s === "bike" ? "h-4 w-1 rounded bg-bike" : "h-4 w-1 rounded bg-line"} />
          {t}
        </li>
      ))}
    </ul>
  );
}

export default function CoachPage() {
  return (
    <>
      <PageHeader title="Coach AI" subtitle="Parla con il coach dei tuoi allenamenti e degli imprevisti." />

      <Card className="mb-6 border-estimate/40 bg-estimate/5 text-sm text-estimate">
        Questa è un&apos;anteprima dell&apos;interfaccia. La chat non è ancora collegata all&apos;AI: le risposte qui sotto sono esempi fissi.
      </Card>

      <div className="flex flex-col gap-3">
        {MESSAGES.map((m, i) =>
          m.from === "user" ? (
            <p key={i} className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-surface-2 px-4 py-3 text-sm">{m.text}</p>
          ) : (
            <div key={i} className="flex max-w-[92%] gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-run to-bike"><Bot className="size-4 text-white" aria-hidden /></span>
              <p className="rounded-2xl rounded-tl-md border border-line bg-surface px-4 py-3 text-sm leading-relaxed">{m.text}</p>
            </div>
          ),
        )}
      </div>

      <section className="mt-6">
        <SectionTitle hint="esempio">Proposta di modifica</SectionTitle>
        <Card className="flex flex-col gap-5">
          <div className="grid items-start gap-4 sm:grid-cols-[1fr_auto_1fr]">
            <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">Programma originale</p><PlanList rows={ORIGINAL} /></div>
            <ArrowRight className="hidden size-5 self-center text-faint sm:block" aria-hidden />
            <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ok">Programma proposto</p><PlanList rows={PROPOSED} /></div>
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-xl bg-surface-2 p-3"><p className="font-semibold">Perché</p><p className="mt-1 text-muted">Le ripetute restano nella settimana e tra due sedute intense c&apos;è almeno un giorno facile.</p></div>
            <div className="rounded-xl bg-surface-2 p-3"><p className="font-semibold">Compromesso</p><p className="mt-1 text-muted">Salta la pedalata di recupero di venerdì e la corsa facile si accorcia di 10 minuti.</p></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button disabled className="min-h-12 rounded-xl border border-line text-sm font-semibold text-faint">Rifiuta</button>
            <button disabled className="min-h-12 rounded-xl bg-fg/20 text-sm font-semibold text-faint">Applica modifica</button>
          </div>
        </Card>
      </section>

      <div className="sticky bottom-20 mt-8 flex items-center gap-2 rounded-2xl border border-line bg-surface p-2 md:bottom-4">
        <button disabled aria-label="Parla al coach" className="grid size-11 place-items-center rounded-xl text-faint"><Mic className="size-5" /></button>
        <input disabled placeholder="Scrivi al coach (disponibile nella Milestone 7)" className="min-h-11 min-w-0 flex-1 bg-transparent px-2 text-sm placeholder:text-faint" />
        <button disabled aria-label="Invia" className="grid size-11 place-items-center rounded-xl bg-surface-2 text-faint"><SendHorizontal className="size-5" /></button>
      </div>
    </>
  );
}
