import { Camera, PencilLine } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { WorkoutList } from "@/components/workout-list";
import { getData } from "@/lib/demo/store";

export const dynamic = "force-dynamic";

export default function WorkoutsPage() {
  const { plan, today } = getData();
  return (
    <>
      <PageHeader title="Allenamenti" subtitle="Sedute in programma e storico delle attività." />
      <div className="mb-6 grid grid-cols-2 gap-3">
        <button disabled className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-line bg-surface text-sm font-semibold text-faint" title="Disponibile nella Milestone 7">
          <Camera className="size-5" aria-hidden /> Carica screenshot
        </button>
        <button disabled className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-line bg-surface text-sm font-semibold text-faint" title="Disponibile nella Milestone 5">
          <PencilLine className="size-5" aria-hidden /> Inserisci a mano
        </button>
      </div>
      <p className="-mt-3 mb-6 text-xs text-faint">Caricamento e inserimento manuale arriveranno nelle prossime milestone.</p>
      <WorkoutList plan={plan} today={today} />
    </>
  );
}
