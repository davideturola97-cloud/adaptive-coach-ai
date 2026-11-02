import { PageHeader } from "@/components/ui";
import { getAppData } from "@/lib/data/repository";
import { SPORT_KEYS } from "@/lib/domain/sports";
import { RescheduleConversation } from "./conversation";

export const dynamic = "force-dynamic";

export default async function ReschedulePage({ searchParams }: { searchParams: Promise<{ seduta?: string }> }) {
  const { seduta } = await searchParams;
  const { today, athlete, plan, mode } = await getAppData();
  const w = seduta ? plan.find((p) => p.id === seduta) : undefined;
  const sports = athlete.sports.length ? athlete.sports.map((s) => s.sport) : SPORT_KEYS;
  return (
    <>
      <PageHeader title="Ho un imprevisto" subtitle="Rispondi a qualche domanda: il coach ti propone come riorganizzare il programma e tu scegli. Niente cambia finché non confermi." />
      <RescheduleConversation
        key={seduta ?? "nuova"}
        today={today}
        sports={sports.filter((s) => s !== "gym")}
        demo={mode === "demo"}
        start={w ? { from: w.date, workoutId: w.id, workoutTitle: w.title, skipped: w.status === "saltato" } : undefined}
      />
    </>
  );
}
