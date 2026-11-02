import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { getAppData, getPlanVersions } from "@/lib/data/repository";
import { UndoButton } from "./undo-button";

export const dynamic = "force-dynamic";

const KIND_LABEL = { generazione: "Programma generato", modifica: "Modifica", annullamento: "Annullamento" } as const;

export default async function PlanHistoryPage() {
  const { mode } = await getAppData();
  const versions = await getPlanVersions();
  const latest = versions.find((v) => !v.undone && v.kind !== "annullamento");
  const fmt = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <Link href="/programma" className="mb-2 inline-flex min-h-11 items-center gap-2 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden /> Programma
      </Link>
      <PageHeader title="Storico del programma" subtitle="Ogni generazione e ogni modifica crea una versione. Puoi annullare l'ultima." />
      {mode === "demo" && <Card className="text-sm text-muted">In modalità dimostrativa non c&apos;è uno storico.</Card>}
      <ol className="flex flex-col gap-2">
        {versions.map((v) => (
          <li key={v.id}>
            <Card className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{KIND_LABEL[v.kind]}</span>
                <span className="text-xs text-muted">{fmt.format(new Date(v.createdAt))}</span>
              </div>
              <p className={v.undone ? "text-muted line-through" : "font-medium"}>{v.reason || "Senza descrizione"}</p>
              {v.kind === "modifica" && <p className="text-xs text-muted">{v.changes === 1 ? "1 seduta toccata" : `${v.changes} sedute toccate`}</p>}
              {v.undone && <p className="text-xs text-muted">Annullata</p>}
              {latest?.id === v.id && <UndoButton id={v.id} />}
            </Card>
          </li>
        ))}
        {mode === "utente" && !versions.length && <Card className="text-sm text-muted">Ancora nessuna versione.</Card>}
      </ol>
    </>
  );
}
