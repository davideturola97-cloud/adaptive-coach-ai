import { describe, expect, it } from "vitest";
import type { CompletedActivity } from "@/lib/domain/types";
import { waitingFeedback } from "./waiting";

const a = (id: string, date: string, o: Partial<CompletedActivity> = {}): CompletedActivity => ({ id, date, sport: "run", title: "", durationMin: 40, source: "strava", ...o });

describe("attività che aspettano l'RPE", () => {
  it("solo Strava, ultimi 14 giorni, senza feedback e non saltate, dalla più recente", () => {
    const list = [
      a("vecchia", "2026-10-10"),
      a("recente", "2026-11-01"),
      a("ieri", "2026-11-02"),
      a("saltata", "2026-11-02", { feedbackSkipped: true }),
      a("manuale", "2026-11-02", { source: "manuale" }),
      a("fatta", "2026-11-02", { feedback: { rpe: 5, muscleFatigue: 2, cardioFatigue: 2, feeling: "buono" } }),
    ];
    expect(waitingFeedback(list, "2026-11-03").map((x) => x.id)).toEqual(["ieri", "recente"]);
  });
});
