"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { persistProfile } from "@/lib/data/mutations";
import { eventFromForm, eventRow } from "@/lib/domain/event-schema";
import { profileFromForm } from "@/lib/domain/profile-schema";
import { SPORT_KEYS } from "@/lib/domain/sports";
import { getUser } from "@/lib/supabase/server";
import { evaluateReadiness, proposeInitialTests, READINESS_QUESTIONS } from "@/lib/training/tests";

export type OnboardingState = { errors?: string[] };

export async function completeOnboarding(_: OnboardingState, fd: FormData): Promise<OnboardingState> {
  // Attrezzatura: caselle predefinite + testo libero.
  const equipment = [...fd.getAll("equipmentChip").map(String), String(fd.get("equipmentOther") ?? "")].filter(Boolean).join("\n");
  fd.set("equipment", equipment);

  const errors: string[] = [];
  const profile = profileFromForm(fd);
  if (!profile.success) errors.push(...profile.error.issues.map((i) => i.message));

  const events = fd
    .getAll("eventIndex")
    .map(String)
    .filter((i) => fd.get(`ev${i}.name`) || fd.get(`ev${i}.date`))
    .map((i) => eventFromForm(fd, `ev${i}.`));
  events.forEach((e, n) => {
    if (!e.success) errors.push(...e.error.issues.map((i) => `Gara ${n + 1}: ${i.message}`));
  });

  if (errors.length || !profile.success) return { errors: [...new Set(errors)] };

  const { supabase, user } = await getUser();
  if (!user) return { errors: ["Sessione scaduta: accedi di nuovo."] };

  const p = profile.data;
  const saveError = await persistProfile(supabase, user.id, p, { onboarding_completed: true });
  if (saveError) return { errors: [saveError] };

  const validEvents = events.flatMap((e) => (e.success ? [eventRow(e.data)] : []));
  if (validEvents.length) {
    const { error } = await supabase.from("events").insert(validEvents);
    if (error) return { errors: ["Salvataggio delle gare non riuscito."] };
  }

  const answers = Object.fromEntries(READINESS_QUESTIONS.map((q) => [q.id, fd.get(`q.${q.id}`) === "si"]));
  const readiness = evaluateReadiness(answers);
  await supabase.from("readiness_checks").insert({ answers, flagged: readiness.flagged });

  // Test iniziali: uno per sport, solo se non ce n'è già uno aperto.
  const sports = SPORT_KEYS.filter((k) => p[k].enabled).map((k) => ({ sport: k, level: p[k].level, yearsExperience: p[k].yearsExperience ?? 0 }));
  const proposals = proposeInitialTests(sports, { canSwim400: p.swimDetails.canSwim400 });
  const { data: open } = await supabase.from("planned_tests").select("sport").in("status", ["proposto", "programmato", "rimandato"]);
  const openSports = new Set((open ?? []).map((r) => r.sport));
  const rows = proposals.filter((x) => !openSports.has(x.sport)).map((x) => ({ sport: x.sport, kind: x.kind, reason: x.reason }));
  if (rows.length) await supabase.from("planned_tests").insert(rows);

  revalidatePath("/", "layout");
  redirect("/test?benvenuto=1");
}
