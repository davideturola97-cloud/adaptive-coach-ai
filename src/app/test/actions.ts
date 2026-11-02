"use server";

import { revalidatePath } from "next/cache";
import { todayISO } from "@/lib/dates";
import type { Sport, TestKind } from "@/lib/domain/types";
import { getAppData } from "@/lib/data/repository";
import { getUser } from "@/lib/supabase/server";
import { parseTime } from "@/lib/training/formulas";
import { declineDate, evaluateReadiness, evaluateTest, pickTestDay, postponeDate, READINESS_QUESTIONS, TEST_CATALOG, type TestInput } from "@/lib/training/tests";

export type TestState = { error?: string; ok?: string };

const done = (ok: string): TestState => {
  revalidatePath("/", "layout");
  return { ok };
};

async function ownTest(id: string) {
  const { supabase, user } = await getUser();
  if (!user) return null;
  const { data } = await supabase.from("planned_tests").select("*").eq("id", id).maybeSingle();
  return data ? { supabase, test: data } : null;
}

/** Rimanda, programma in automatico o rifiuta temporaneamente un test. Nessuna di queste azioni blocca il programma. */
export async function changeTest(_: TestState, fd: FormData): Promise<TestState> {
  const id = String(fd.get("id") ?? "");
  const op = String(fd.get("op") ?? "");
  const own = await ownTest(id);
  if (!own) return { error: "Test non trovato." };
  const today = todayISO();

  let patch: Record<string, unknown>;
  let message: string;
  if (op === "rimanda1" || op === "rimanda2") {
    const weeks = op === "rimanda1" ? 1 : 2;
    patch = { status: "rimandato", due_date: postponeDate(today, weeks) };
    message = `Test rimandato di ${weeks === 1 ? "una settimana" : "due settimane"}. Nel frattempo il coach usa i parametri che ha, con prudenza.`;
  } else if (op === "auto") {
    if (TEST_CATALOG[own.test.kind as TestKind].maximal) {
      const blocked = await readinessBlocksMaximal();
      if (blocked) return { error: blocked };
    }
    const { athlete, events, plannedTests } = await getAppData();
    const busy = plannedTests.filter((t) => t.status === "programmato" && t.dueDate && t.id !== id).map((t) => t.dueDate!);
    const day = pickTestDay(today, athlete.availableDays, events, busy);
    if (!day) return { error: "Non ho trovato un giorno adatto nelle prossime 6 settimane. Prova a rimandare." };
    patch = { status: "programmato", due_date: day };
    message = "Test programmato nel primo giorno adatto: lontano dalle gare e in un giorno in cui ti alleni.";
  } else if (op === "rifiuta") {
    patch = { status: "rifiutato", due_date: declineDate(today) };
    message = "Va bene, niente test per ora. Te lo riproporrò tra 4 settimane; intanto si lavora a sensazione (RPE).";
  } else {
    return { error: "Operazione non valida." };
  }
  const { error } = await own.supabase.from("planned_tests").update(patch).eq("id", id);
  if (error) return { error: "Modifica non riuscita. Riprova." };
  return done(message);
}

/** Ultimo controllo di sicurezza: se ha risposte positive senza via libera del medico, i test massimali non si programmano. */
async function readinessBlocksMaximal(): Promise<string | null> {
  const { supabase } = await getUser();
  const { data } = await supabase.from("readiness_checks").select("flagged, doctor_cleared, created_at").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!data) return "Prima di un test a tutta rispondi alle domande di sicurezza in questa pagina.";
  if (data.flagged && !data.doctor_cleared) return "Hai segnalato un possibile problema di salute: prima di un test a tutta serve il via libera del medico. Puoi intanto inserire un risultato recente o rimandare.";
  return null;
}

export async function saveReadiness(_: TestState, fd: FormData): Promise<TestState> {
  const { supabase, user } = await getUser();
  if (!user) return { error: "Sessione scaduta: accedi di nuovo." };
  const answers = Object.fromEntries(READINESS_QUESTIONS.map((q) => [q.id, fd.get(`q.${q.id}`) === "si"]));
  const r = evaluateReadiness(answers);
  const cleared = r.flagged && fd.get("doctorCleared") === "on";
  const { error } = await supabase.from("readiness_checks").insert({ answers, flagged: r.flagged, doctor_cleared: cleared });
  if (error) return { error: "Salvataggio non riuscito." };
  return done(r.flagged && !cleared ? "Risposte salvate. Per i test a tutta aspettiamo il via libera del medico." : "Risposte salvate. Puoi programmare i test.");
}

/** Converte i campi del modulo nel risultato di un test. */
function readInput(kind: TestKind, fd: FormData): TestInput | string {
  const t = (k: string) => parseTime(String(fd.get(k) ?? ""));
  const n = (k: string) => Number(String(fd.get(k) ?? "").replace(",", "."));
  switch (kind) {
    case "5km": { const s = t("time"); return s ? { kind, timeSec: s } : "Scrivi il tempo come mm:ss, per esempio 24:30"; }
    case "cooper": { const m = n("meters"); return m > 0 ? { kind, meters: Math.round(m) } : "Scrivi i metri percorsi"; }
    case "recente_corsa": {
      const km = n("distanceKm"); const s = t("time");
      return km > 0 && s ? { kind, distanceM: Math.round(km * 1000), timeSec: s } : "Inserisci distanza in km e tempo (mm:ss o h:mm:ss)";
    }
    case "ftp20": { const w = n("watts"); return w > 0 ? { kind, avgPowerW: Math.round(w) } : "Scrivi la potenza media in watt"; }
    case "ramp": { const w = n("watts"); return w > 0 ? { kind, best1MinW: Math.round(w) } : "Scrivi la miglior potenza di 1 minuto"; }
    case "ftp_nota": { const w = n("watts"); return w > 0 ? { kind, ftpW: Math.round(w) } : "Scrivi la tua FTP in watt"; }
    case "css": {
      const a = t("t400"); const b = t("t200");
      return a && b ? { kind, t400Sec: a, t200Sec: b } : "Scrivi i due tempi come mm:ss, per esempio 7:20 e 3:30";
    }
    case "recente_nuoto": {
      const m = n("distanceM"); const s = t("time");
      return m > 0 && s ? { kind, distanceM: Math.round(m), timeSec: s } : "Inserisci distanza in metri e tempo (mm:ss)";
    }
  }
}

export async function recordResult(_: TestState, fd: FormData): Promise<TestState> {
  const kind = String(fd.get("kind") ?? "") as TestKind;
  if (!(kind in TEST_CATALOG)) return { error: "Tipo di test non valido." };
  const date = String(fd.get("date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > todayISO()) return { error: "Inserisci una data valida, non nel futuro." };

  const input = readInput(kind, fd);
  if (typeof input === "string") return { error: input };
  let evaluated;
  try {
    evaluated = evaluateTest(input);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Valori non validi." };
  }

  const { supabase, user } = await getUser();
  if (!user) return { error: "Sessione scaduta: accedi di nuovo." };
  const sport: Sport = TEST_CATALOG[kind].sport;

  const { data: result, error } = await supabase
    .from("test_results")
    .insert({ test_date: date, sport, kind, raw_value: { text: evaluated.raw, input }, derived: evaluated.derived })
    .select("id")
    .single();
  if (error || !result) return { error: "Salvataggio del risultato non riuscito." };

  const origin = kind === "ftp_nota" ? "dichiarato" : "stimato";
  const u = evaluated.update;
  const patch = {
    ...(u.thresholdPaceSec && { threshold_pace_sec: u.thresholdPaceSec, threshold_origin: origin, threshold_date: date }),
    ...(u.ftpW && { ftp_w: u.ftpW, ftp_origin: origin, ftp_date: date }),
    ...(u.cssPaceSec && { css_pace_sec: u.cssPaceSec, css_origin: origin, css_date: date }),
  };
  await supabase.from("profiles").update(patch).eq("user_id", user.id);

  // Chiude il test aperto di quello sport, se c'è.
  await supabase
    .from("planned_tests")
    .update({ status: "completato", test_result_id: result.id })
    .eq("sport", sport)
    .in("status", ["proposto", "programmato", "rimandato", "rifiutato"]);

  return done(`Risultato salvato: ${evaluated.derived.map((d) => `${d.label} ${d.value}`).slice(0, 2).join(" · ")} (stima).`);
}

/** Propone un nuovo test per uno sport (per esempio una rivalutazione). */
export async function proposeTest(_: TestState, fd: FormData): Promise<TestState> {
  const kind = String(fd.get("kind") ?? "") as TestKind;
  if (!(kind in TEST_CATALOG)) return { error: "Tipo di test non valido." };
  const { supabase, user } = await getUser();
  if (!user) return { error: "Sessione scaduta: accedi di nuovo." };
  const sport = TEST_CATALOG[kind].sport;
  await supabase.from("planned_tests").update({ status: "completato" }).eq("sport", sport).eq("status", "rifiutato");
  const { error } = await supabase.from("planned_tests").insert({ sport, kind, reason: "Richiesto da te." });
  if (error) return { error: "C'è già un test aperto per questo sport." };
  return done("Test aggiunto.");
}
