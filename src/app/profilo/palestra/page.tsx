import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { GymAdviceList } from "@/components/gym-advice";
import { Card, PageHeader, SectionTitle } from "@/components/ui";
import { getAppData } from "@/lib/data/repository";
import { gymAdvice } from "@/lib/training/gym-schedule";
import { scheduleProgress } from "@/lib/training/gym-progress";
import { GymForm } from "./gym-form";

export const dynamic = "force-dynamic";

export default async function GymSchedulePage() {
  const { athlete, plan, events, today, mode, activities } = await getAppData();
  const schedule = athlete.gymSchedule ?? [];
  const advice = gymAdvice(schedule, plan, events, athlete, today);
  const progress = scheduleProgress(schedule, activities, events, today);
  const COLOR = { aumenta: "text-ok", riduci: "text-bad", mantieni: "text-muted", nuovo: "text-muted" } as const;
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
        {progress.length > 0 && (
          <section>
            <SectionTitle hint="dalle sedute registrate">Progressione dei carichi</SectionTitle>
            <Card>
              <ul className="flex flex-col">
                {progress.map((p) => (
                  <li key={p.day + p.name} className="flex flex-col gap-0.5 border-b border-line py-2 last:border-0">
                    <span className="flex justify-between gap-3">
                      <span className="font-medium">{p.name} <span className="text-xs text-muted">· {p.day}</span></span>
                      <span className={`num shrink-0 font-semibold ${COLOR[p.action]}`}>{p.loadKg !== undefined ? `${String(p.loadKg).replace(".", ",")} kg` : "–"}</span>
                    </span>
                    <span className="text-xs text-muted">{p.reason}</span>
                  </li>
                ))}
              </ul>
            </Card>
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
