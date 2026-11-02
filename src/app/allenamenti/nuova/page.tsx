import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ActivityForm } from "@/components/activity-form";
import { PageHeader } from "@/components/ui";
import { getAppData } from "@/lib/data/repository";
import { SPORT_KEYS } from "@/lib/domain/sports";

export const dynamic = "force-dynamic";

export default async function NewActivityPage() {
  const { today, athlete, mode } = await getAppData();
  const sports = athlete.sports.length ? athlete.sports.map((s) => s.sport) : SPORT_KEYS;
  return (
    <>
      <Link href="/allenamenti" className="mb-2 inline-flex min-h-11 items-center gap-2 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden /> Allenamenti
      </Link>
      <PageHeader title="Nuova attività" subtitle="Un allenamento fuori programma, una gara o una seduta che vuoi registrare a mano. Se nel programma c'è una seduta dello stesso sport quel giorno, la collego io." />
      <ActivityForm defaults={{ date: today }} sports={sports} today={today} demo={mode === "demo"} />
    </>
  );
}
