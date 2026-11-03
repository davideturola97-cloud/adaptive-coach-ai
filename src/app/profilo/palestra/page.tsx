import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { GymAdviceList } from "@/components/gym-advice";
import { Card, PageHeader, SectionTitle } from "@/components/ui";
import { getAppData } from "@/lib/data/repository";
import { gymAdvice } from "@/lib/training/gym-schedule";
import { GymForm } from "./gym-form";

export const dynamic = "force-dynamic";

export default async function GymSchedulePage() {
  const { athlete, plan, events, today, mode } = await getAppData();
  const schedule = athlete.gymSchedule ?? [];
  const advice = gymAdvice(schedule, plan, events, athlete, today);
  return (
    <>
      <Link href="/profilo" className="mb-2 inline-flex min-h-11 items-center gap-2 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden /> Profilo
      </Link>
      <PageHeader title="Scheda di palestra" subtitle="I tuoi giorni fissi e i gruppi muscolari. Il coach controlla gli incastri con corsa, bici, nuoto e gare." />
      <div className="flex flex-col gap-6">
        {schedule.length > 0 && (
          <section>
            <SectionTitle>Consigli del coach</SectionTitle>
            <Card><GymAdviceList advice={advice} /></Card>
          </section>
        )}
        <section>
          <SectionTitle>La tua scheda</SectionTitle>
          <GymForm schedule={schedule} demo={mode === "demo"} />
        </section>
      </div>
    </>
  );
}
