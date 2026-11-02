import { describe, expect, it } from "vitest";
import type { AthleteProfile, PlannedWorkout, RaceEvent } from "@/lib/domain/types";
import { generatePlan } from "@/lib/planning/engine";
import { type CoachData, dayByDay, runCoach, runTool, systemPrompt } from "./coach";
import { limitMessage } from "./limits";
import { type ChatClient, type ChatRequest, openAiClient } from "./openai";
import { vi } from "vitest";
import { normalizeExtraction } from "./screenshot";

const athlete: AthleteProfile = {
  name: "Davide",
  sports: [{ sport: "run", level: "intermedio", yearsExperience: 4 }, { sport: "bike", level: "intermedio", yearsExperience: 2 }],
  weeklyHoursAvailable: 7, availableDays: ["Lun", "Mar", "Mer", "Gio", "Sab", "Dom"], maxSessionMin: 75, longDays: ["Sab", "Dom"],
  sportDays: {}, equipment: [], limitations: ["Achille sinistro"], goals: { primary: "Mezza sotto 1:40", secondary: [] },
};
const events: RaceEvent[] = [{ id: "r", name: "Reggio", date: "2026-12-13", kind: "singolo", sport: "run", priority: "A" }];
const today = "2026-11-16";
const plan: PlannedWorkout[] = generatePlan({ today, startDate: today, athlete, events, weeks: 3 }).workouts.map((w, i) => ({ ...w, id: `w${i}`, status: "programmato" }));
const data: CoachData = { today, athlete, plan, activities: [], events, tests: [], plannedTests: [] };

describe("prompt di sistema", () => {
  it("contiene le regole di sicurezza e i dati dell'atleta", () => {
    const p = systemPrompt(data);
    expect(p).toMatch(/Non modifichi mai il programma/);
    expect(p).toMatch(/Non fai diagnosi/);
    expect(p).toContain("Reggio");
    expect(p).toContain("Achille sinistro");
    expect(p).toContain(plan[0].id);
  });
});

describe("calendario per il coach", () => {
  const cal = dayByDay(data);
  it("ogni giorno ha nome italiano, data e sedute; oggi e domani sono indicati", () => {
    expect(cal).toMatch(/lunedì 16 novembre = 2026-11-16 \[OGGI\]/);
    expect(cal).toMatch(/martedì 17 novembre = 2026-11-17 \[domani\]/);
    for (const w of plan.filter((p) => p.date <= "2026-12-07")) expect(cal).toContain(w.id);
  });
  it("i giorni senza sedute sono scritti come riposo", () => {
    expect(cal.split("\n").some((l) => l.includes("riposo, nessuna seduta"))).toBe(true);
  });
  it("il prompt vieta di chiedere all'atleta il proprio programma", () => {
    expect(systemPrompt(data)).toMatch(/NON chiedere mai all'atleta che allenamento ha/);
  });
});

describe("strumenti del coach", () => {
  it("leggi_programma rifiuta date non valide e limita a 31 giorni", () => {
    expect(runTool("leggi_programma", JSON.stringify({ dal: "ieri", al: "oggi" }), { data })).toBe("Date non valide.");
    const out = runTool("leggi_programma", JSON.stringify({ dal: "2026-11-16", al: "2027-12-31" }), { data });
    expect(out.split("\n").every((l) => l.slice(0, 10) <= "2026-12-17")).toBe(true);
  });
  it("strumenti sconosciuti e JSON rotti non fanno danni", () => {
    expect(runTool("cancella_tutto", "{}", { data })).toBe("Strumento sconosciuto.");
    expect(runTool("leggi_test", "{non json", { data })).toBe("Argomenti non validi.");
  });
  it("proponi_riprogrammazione usa il motore e conserva le proposte per l'interfaccia", () => {
    const ctx = { data };
    const out = runTool("proponi_riprogrammazione", JSON.stringify({ tipo: "nessun_allenamento", dal: plan[0].date }), ctx);
    expect(out).toMatch(/Opzione/);
    expect((ctx as { proposals?: unknown }).proposals).toBeDefined();
  });
  it("un tipo di imprevisto inventato viene rifiutato", () => {
    expect(runTool("proponi_riprogrammazione", JSON.stringify({ tipo: "aggiungi_carico", dal: today }), { data })).toMatch(/non validi/);
  });
});

describe("conversazione", () => {
  it("chiama lo strumento, poi risponde: le proposte arrivano all'interfaccia", async () => {
    const calls: ChatRequest[] = [];
    const fake: ChatClient = async (req) => {
      calls.push(req);
      if (calls.length === 1) {
        return { message: { content: null, tool_calls: [{ id: "t1", type: "function", function: { name: "proponi_riprogrammazione", arguments: JSON.stringify({ tipo: "nessun_allenamento", dal: plan[0].date }) } }] }, usage: { input: 100, output: 20 } };
      }
      return { message: { content: "Ti consiglio di spostare le ripetute." }, usage: { input: 150, output: 30 } };
    };
    const turn = await runCoach({ client: fake, model: "m", data, history: [], message: "Martedì ho una cena" });
    expect(turn.reply).toMatch(/spostare/);
    expect(turn.proposals?.result.proposals.length).toBeGreaterThan(0);
    expect(turn.usage).toEqual({ input: 250, output: 50 });
    expect(calls[1].messages.some((m) => m.role === "tool")).toBe(true);
  });
  it("si ferma dopo troppi giri di strumenti", async () => {
    const loop: ChatClient = async () => ({ message: { content: null, tool_calls: [{ id: "x", type: "function", function: { name: "leggi_test", arguments: "{}" } }] }, usage: { input: 1, output: 1 } });
    const turn = await runCoach({ client: loop, model: "m", data, history: [], message: "?" });
    expect(turn.reply).toBeTruthy();
  });
});

describe("limiti di uso", () => {
  const lim = { requests: 10, tokens: 1000, images: 2 };
  it("blocca oltre i limiti", () => {
    expect(limitMessage({ requests: 10, inputTokens: 0, outputTokens: 0, images: 0 }, lim)).toMatch(/limite/);
    expect(limitMessage({ requests: 1, inputTokens: 900, outputTokens: 200, images: 0 }, lim)).toMatch(/limite/);
    expect(limitMessage({ requests: 1, inputTokens: 0, outputTokens: 0, images: 2 }, lim, true)).toMatch(/screenshot/);
    expect(limitMessage({ requests: 1, inputTokens: 0, outputTokens: 0, images: 2 }, lim, false)).toBeNull();
  });
});

describe("lettura screenshot", () => {
  const base = { e_attivita: true, app: "Strava", sport: "run", data: "2026-11-15", titolo: "Corsa", durata_minuti: 52.5, distanza_km: 10.1, passo: "5:12 /km", velocita_kmh: null, fc_media: 152, potenza_media_w: null, dislivello_m: 40, intervalli: null, illeggibili: [] };
  it("accetta valori plausibili", () => {
    const e = normalizeExtraction(base, today)!;
    expect(e.distanza_km).toBe(10.1);
    expect(e.scartati).toEqual([]);
  });
  it("scarta valori impossibili invece di correggerli", () => {
    const e = normalizeExtraction({ ...base, fc_media: 400, data: "2030-01-01" }, today)!;
    expect(e.fc_media).toBeNull();
    expect(e.data).toBeNull();
    expect(e.scartati.join(" ")).toMatch(/frequenza cardiaca/);
  });
  it("corsa troppo veloce per la durata: distanza scartata", () => {
    const e = normalizeExtraction({ ...base, distanza_km: 50, durata_minuti: 30 }, today)!;
    expect(e.distanza_km).toBeNull();
  });
  it("risposta non valida: nessun dato", () => {
    expect(normalizeExtraction("ciao", today)).toBeNull();
    expect(normalizeExtraction({ app: "x" }, today)).toBeNull();
  });
});

describe("errori di OpenAI", () => {
  const reply = (status: number, body: unknown) => vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));
  const req = { model: "gpt-x", messages: [] };
  it("credito esaurito", async () => {
    reply(429, { error: { code: "insufficient_quota", message: "You exceeded your current quota" } });
    await expect(openAiClient("sk-test")(req)).rejects.toThrow(/Credito OpenAI esaurito/);
  });
  it("modello non disponibile: indica come cambiarlo", async () => {
    reply(404, { error: { code: "model_not_found", message: "The model gpt-x does not exist" } });
    await expect(openAiClient("sk-test")(req)).rejects.toThrow(/OPENAI_MODEL/);
  });
  it("chiave sbagliata, e la chiave non compare mai nel messaggio", async () => {
    reply(401, { error: { message: "Incorrect API key provided: sk-abc123" } });
    const err = await openAiClient("sk-abc123")(req).catch((e) => e as Error);
    expect(err.message).toMatch(/non accetta la chiave/);
    expect(err.message).not.toContain("sk-abc123");
  });
});
