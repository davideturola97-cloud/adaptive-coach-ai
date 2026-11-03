import { addDays } from "@/lib/dates";
import type { CompletedActivity } from "@/lib/domain/types";

/** Giorni entro cui ha senso chiedere l'RPE: dopo, il ricordo non è affidabile e non serve più al programma. */
export const RPE_WINDOW_DAYS = 14;

/** Attività importate (es. da Strava) che aspettano lo sforzo percepito, dalla più recente. */
export function waitingFeedback(activities: CompletedActivity[], today: string): CompletedActivity[] {
  const from = addDays(today, -RPE_WINDOW_DAYS);
  return activities
    .filter((a) => a.source === "strava" && !a.feedback && !a.feedbackSkipped && a.date >= from)
    .sort((x, y) => y.date.localeCompare(x.date));
}
