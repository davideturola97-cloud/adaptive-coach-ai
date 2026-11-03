import { CheckCircle2, Lightbulb, TriangleAlert } from "lucide-react";
import type { GymAdvice } from "@/lib/training/gym-schedule";

const ICON = { attenzione: TriangleAlert, consiglio: Lightbulb, ok: CheckCircle2 } as const;
const COLOR = { attenzione: "text-warn", consiglio: "text-muted", ok: "text-ok" } as const;

/** Consigli del coach sulla scheda di palestra. */
export function GymAdviceList({ advice }: { advice: GymAdvice[] }) {
  if (!advice.length) return null;
  return (
    <ul className="flex flex-col gap-2">
      {advice.map((a) => {
        const Icon = ICON[a.level];
        return (
          <li key={a.text} className="flex gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
            <Icon className={`mt-0.5 size-4 shrink-0 ${COLOR[a.level]}`} aria-hidden />
            <span>{a.text}</span>
          </li>
        );
      })}
    </ul>
  );
}
