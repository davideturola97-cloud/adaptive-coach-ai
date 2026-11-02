/**
 * Il "cervello" del coach AI. L'AI conversa e spiega; i numeri e le modifiche vengono dal codice:
 * - legge i dati dell'atleta solo attraverso strumenti di lettura (mai il database direttamente);
 * - per riprogrammare chiama il motore della Milestone 6, che applica le regole di sicurezza;
 * - non può applicare modifiche: le proposte tornano all'interfaccia, dove l'atleta conferma.
 */
import { addDays, formatDayMonth, weekdayName } from "@/lib/dates";
import { SPORTS, WORKOUT_TYPE_LABEL } from "@/lib/domain/sports";
import type { AthleteProfile, CompletedActivity, PlannedTest, PlannedWorkout, RaceEvent, TestResult } from "@/lib/domain/types";
import { type Disruption, proposeReschedule, type RescheduleResult } from "@/lib/planning/reschedule";
import { loadState } from "@/lib/training/analytics";
import { feedbackSignals } from "@/lib/training/feedback";
import { formatDuration, formatPace, formatSwimPace } from "@/lib/training/formulas";
import { analyzeSplits } from "@/lib/training/splits";
import { analyzeActivity } from "@/lib/training/analysis";
import { TEST_CATALOG } from "@/lib/training/tests";
import type { ChatClient, ChatMessage, ToolDef } from "./openai";

export interface CoachData {
  today: string;
  athlete: AthleteProfile;
  plan: PlannedWorkout[];
  activities: CompletedActivity[];
  events: RaceEvent[];
  tests: TestResult[];
  plannedTests: PlannedTest[];
}

const d = (iso: string) => `${weekdayName(iso, true)} ${formatDayMonth(iso)}`;

function workoutLine(w: PlannedWorkout) {
  return `${w.date} (${d(w.date)}) · ${SPORTS[w.sport].label} · ${w.title} [${WORKOUT_TYPE_LABEL[w.type]}] · ${formatDuration(w.durationMin)} · ${w.intensity} · stato: ${w.status} · id: ${w.id}`;
}

const WEEKDAY_FULL = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];

/**
 * Calendario esplicito giorno per giorno: nome del giorno in italiano, "oggi/domani/ieri" e sedute.
 * Così l'AI non deve calcolare le date da sola (era la causa di "non hai allenamenti" detto per errore).
 */
export function dayByDay(x: CoachData, pastDays = 7, nextDays = 21): string {
  const rel: Record<number, string> = { [-1]: "ieri", 0: "OGGI", 1: "domani", 2: "dopodomani" };
  const lines: string[] = [];
  for (let i = -pastDays; i <= nextDays; i++) {
    const date = addDays(x.today, i);
    const wd = WEEKDAY_FULL[new Date(`${date}T12:00:00Z`).getUTCDay()];
    const tag = rel[i] ? ` [${rel[i]}]` : i > 0 && i < 7 ? ` [prossimo ${wd}]` : "";
    const ws = x.plan.filter((w) => w.date === date);
    const acts = x.activities.filter((a) => a.date === date && !x.plan.some((w) => w.completedActivityId === a.id));
    const races = x.events.filter((e) => e.date === date);
    const parts = [
      ...races.map((e) => `GARA ${e.name} (${e.priority})`),
      ...ws.map((w) => `${w.title} (${SPORTS[w.sport].label.toLowerCase()}, ${WORKOUT_TYPE_LABEL[w.type]}, ${formatDuration(w.durationMin)}, ${w.status}, id ${w.id})`),
      ...acts.map((a) => `attività fuori programma: ${a.title || SPORTS[a.sport].label} ${formatDuration(a.durationMin)}`),
    ];
    lines.push(`- ${wd} ${formatDayMonth(date, false)} = ${date}${tag}: ${parts.join("; ") || "riposo, nessuna seduta"}`);
  }
  return lines.join("\n");
}

/** Riassunto dei dati dell'atleta per il prompt di sistema: solo i suoi dati, solo il necessario. */
export function athleteContext(x: CoachData): string {
  const a = x.athlete;
  const sports = a.sports.map((s) => `${SPORTS[s.sport].label} (${s.level}, ${s.yearsExperience} anni)`).join(", ") || "nessuno indicato";
  const params = [
    a.thresholdPaceSecPerKm && `soglia corsa ${formatPace(a.thresholdPaceSecPerKm.value)} (${a.thresholdPaceSecPerKm.origin})`,
    a.ftpW && `FTP ${a.ftpW.value} W (${a.ftpW.origin})`,
    a.cssPaceSecPer100m && `CSS nuoto ${formatSwimPace(a.cssPaceSecPer100m.value)} (${a.cssPaceSecPer100m.origin})`,
  ].filter(Boolean).join("; ") || "nessun test: intensità in RPE";
  const races = x.events.filter((e) => e.date >= x.today).map((e) => `${e.name} (${e.kind === "triathlon" ? "triathlon" : e.sport ? SPORTS[e.sport].label : ""}, gara ${e.priority}) il ${e.date}${e.dateTentative ? " (data provvisoria)" : ""}`).join("; ") || "nessuna";
  const calendar = dayByDay(x);
  const load = loadState(x.activities, x.today);
  const signals = feedbackSignals(x.activities, x.plan, x.today).map((s) => `${s.title}: ${s.detail}`).join("\n") || "nessuno";
  return [
    `Oggi è ${x.today} (${weekdayName(x.today)}).`,
    `Atleta: ${a.name}. Sport: ${sports}.`,
    `Disponibilità: giorni ${a.availableDays.join(", ") || "non indicati"}; ${a.weeklyHoursAvailable ?? "?"} ore a settimana; seduta massima ${a.maxSessionMin ?? "?"} min, nei giorni dei lunghi (${a.longDays.join(", ") || "Sab, Dom"}) ${a.longSessionMaxMin ?? a.maxSessionMin ?? "?"} min.`,
    `Limitazioni dichiarate: ${a.limitations.join(", ") || "nessuna"}.`,
    `Obiettivo: ${a.goals.primary || "non indicato"}. Gare: ${races}.`,
    `Parametri: ${params}.`,
    `Carico recente (stima): ${load.state ?? "dati insufficienti"}.`,
    `Segnali dai feedback: ${signals}`,
    `Calendario giorno per giorno (ultimi 7 giorni e prossimi 21), con le sedute del programma:\n${calendar}`,
  ].join("\n");
}

export function systemPrompt(x: CoachData): string {
  return `Sei il coach di Adaptive Coach AI, un allenatore esperto di triathlon, corsa, ciclismo, nuoto e preparazione atletica.
Parli in italiano semplice, con frasi brevi, tono caldo e concreto. Dai del tu.

Regole che non puoi violare:
- Usi solo i dati qui sotto e quelli che leggi con gli strumenti. Non inventare numeri, sedute, test o risultati. Se un dato manca, dillo.
- Distingui sempre i valori misurati da quelli stimati.
- Non modifichi mai il programma. Per qualsiasi cambiamento usa lo strumento proponi_riprogrammazione: le proposte compaiono all'atleta con il pulsante "Applica" e solo lui decide. Non dire mai di aver cambiato qualcosa.
- Il programma dell'atleta è nel calendario qui sotto: NON chiedere mai all'atleta che allenamento ha in un giorno, cercalo tu. Per date oltre il calendario usa lo strumento leggi_programma.
- Quando l'atleta nomina un giorno ("martedì", "domani", "sabato prossimo"), trova la data esatta nel calendario: un giorno della settimana senza altre indicazioni è il prossimo (oggi compreso se è oggi). Usa sempre le date YYYY-MM-DD del calendario negli strumenti.
- Se in quel giorno non ci sono sedute, dillo indicando le sedute dei giorni vicini; non dire mai "non hai allenamenti" senza aver controllato il calendario.
- Se l'atleta dice in che giorno vorrebbe spostare la seduta, passalo come giorno_preferito: il motore verifica se è sicuro. Se non lo è, spiega il motivo che ti restituisce e proponi le alternative. Non dire mai di no senza aver chiamato lo strumento.
- Prima di proporre, chiedi solo ciò che non puoi sapere dai dati: quanto tempo ha, quale sport fa male e quanto è forte il dolore, fino a quando dura un viaggio o la malattia. Una sola domanda alla volta.
- Dopo aver chiamato lo strumento, riassumi le opzioni in poche righe e consiglia quella che sceglieresti, spiegando il perché. Non ripetere tutti i dettagli: l'atleta li vede nelle schede.
- Non fai diagnosi mediche e non suggerisci farmaci. Con dolore forte, dolore al petto, svenimenti, febbre o sintomi che preoccupano, consiglia di fermarsi e sentire un medico.
- Un singolo feedback negativo non è sovrallenamento né una malattia: non trarre conclusioni allarmanti.
- Non proporre mai di recuperare tutto il lavoro perso o di aggiungere carico per compensare.
- Rispondi solo su allenamento, recupero, gare, alimentazione sportiva generale e uso dell'app. Per altro, declina con gentilezza.

Dati dell'atleta (privati, solo per te):
${athleteContext(x)}`;
}

export const COACH_TOOLS: ToolDef[] = [
  {
    type: "function",
    function: {
      name: "leggi_programma",
      description: "Legge le sedute del programma tra due date (massimo 31 giorni).",
      parameters: {
        type: "object",
        properties: { dal: { type: "string", description: "YYYY-MM-DD" }, al: { type: "string", description: "YYYY-MM-DD" } },
        required: ["dal", "al"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "leggi_attivita",
      description: "Legge le attività svolte negli ultimi giorni con il feedback dell'atleta (RPE, fatica, sonno, dolori, note).",
      parameters: { type: "object", properties: { giorni: { type: "integer", minimum: 1, maximum: 60 } }, required: ["giorni"], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "leggi_test",
      description: "Legge i risultati dei test, i parametri stimati e i test in programma.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "proponi_riprogrammazione",
      description:
        "Calcola con le regole di sicurezza le opzioni per riorganizzare il programma dopo un imprevisto. Non applica nulla: le opzioni vengono mostrate all'atleta che sceglie.",
      parameters: {
        type: "object",
        properties: {
          tipo: { type: "string", enum: ["nessun_allenamento", "poco_tempo", "stanco", "dolore", "malato", "viaggio", "saltata"] },
          dal: { type: "string", description: "Primo giorno interessato, YYYY-MM-DD" },
          al: { type: "string", description: "Ultimo giorno (solo viaggio o malattia), YYYY-MM-DD" },
          minuti_disponibili: { type: "integer", minimum: 0, maximum: 600, description: "Solo per poco_tempo" },
          sport_dolore: { type: "string", enum: ["swim", "bike", "run", "gym"], description: "Solo per dolore" },
          dolore_forte: { type: "boolean", description: "Solo per dolore" },
          id_seduta: { type: "string", description: "Solo per saltata: id della seduta saltata" },
          giorno_preferito: { type: "string", description: "Se l'atleta chiede di spostare la seduta in un giorno preciso, YYYY-MM-DD" },
        },
        required: ["tipo", "dal"],
        additionalProperties: false,
      },
    },
  },
];

export interface ToolContext {
  data: CoachData;
  /** Ultime proposte calcolate, da mostrare nell'interfaccia. */
  proposals?: { disruption: Disruption; result: RescheduleResult };
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Esegue uno strumento richiesto dall'AI. Ogni argomento viene controllato: l'AI non può chiedere altro. */
export function runTool(name: string, rawArgs: string, ctx: ToolContext): string {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(rawArgs || "{}");
  } catch {
    return "Argomenti non validi.";
  }
  const { data } = ctx;
  switch (name) {
    case "leggi_programma": {
      const from = String(args.dal ?? ""), to = String(args.al ?? "");
      if (!ISO.test(from) || !ISO.test(to) || to < from) return "Date non valide.";
      const end = to > addDays(from, 31) ? addDays(from, 31) : to;
      const rows = data.plan.filter((w) => w.date >= from && w.date <= end).map(workoutLine);
      return rows.length ? rows.join("\n") : "Nessuna seduta in quel periodo.";
    }
    case "leggi_attivita": {
      const days = Math.min(60, Math.max(1, Number(args.giorni) || 14));
      const rows = data.activities
        .filter((a) => a.date > addDays(data.today, -days))
        .map((a) => {
          const f = a.feedback;
          const fb = f ? ` · RPE ${f.rpe}, fatica muscolare ${f.muscleFatigue}/5, fiato ${f.cardioFatigue}/5${f.sleepQuality ? `, sonno ${f.sleepQuality}/5` : ""}, ${f.feeling}${f.pain ? `, dolore: ${f.pain}` : ""}${f.notes ? `, note: ${f.notes}` : ""}` : " · senza feedback";
          const p = data.plan.find((w) => w.completedActivityId === a.id);
          const an = ` · analisi: ${analyzeActivity(a, { planned: p, athlete: data.athlete, history: data.activities }).findings.join(" ")}`;
          const sp = a.splits?.length ? ` · intertempi: ${analyzeSplits(a.splits, a.sport, p, data.athlete).findings.join(" ")}` : "";
          return `${a.date} · ${SPORTS[a.sport].label} · ${a.title} · ${formatDuration(a.durationMin)}${a.distanceKm ? ` · ${a.distanceKm} km` : ""}${a.avgHr ? ` · FC ${a.avgHr}` : ""}${a.avgPowerW ? ` · ${a.avgPowerW} W` : ""} (misurato)${fb}${an}${sp}`;
        });
      const skipped = data.plan.filter((w) => w.status === "saltato" && w.date > addDays(data.today, -days)).map((w) => `${w.date} · saltata: ${w.title}${w.skipReason ? ` (${w.skipReason})` : ""}`);
      return [...rows, ...skipped].join("\n") || "Nessuna attività registrata in quel periodo.";
    }
    case "leggi_test": {
      const t = data.tests.map((x) => `${x.date} · ${TEST_CATALOG[x.kind]?.label ?? x.kind}: ${x.rawValue} → ${x.derived.map((y) => `${y.label} ${y.value} (${y.origin})`).join(", ")}`);
      const p = data.plannedTests.filter((x) => x.status !== "completato").map((x) => `${TEST_CATALOG[x.kind].label}: ${x.status}${x.dueDate ? ` il ${x.dueDate}` : ""}`);
      return [`Risultati:\n${t.join("\n") || "nessuno"}`, `Test in sospeso:\n${p.join("\n") || "nessuno"}`].join("\n");
    }
    case "proponi_riprogrammazione": {
      const kinds = ["nessun_allenamento", "poco_tempo", "stanco", "dolore", "malato", "viaggio", "saltata"] as const;
      const kind = kinds.find((k) => k === args.tipo);
      const from = String(args.dal ?? "");
      if (!kind || !ISO.test(from)) return "Tipo di imprevisto o data non validi.";
      const to = typeof args.al === "string" && ISO.test(args.al) && args.al >= from ? args.al : undefined;
      const sports = ["swim", "bike", "run", "gym"] as const;
      const disruption: Disruption = {
        kind,
        from,
        to,
        availableMin: typeof args.minuti_disponibili === "number" ? Math.max(0, Math.min(600, Math.round(args.minuti_disponibili))) : undefined,
        painSport: sports.find((s) => s === args.sport_dolore),
        painSevere: typeof args.dolore_forte === "boolean" ? args.dolore_forte : undefined,
        workoutId: typeof args.id_seduta === "string" ? args.id_seduta.slice(0, 64) : undefined,
        preferredDate: typeof args.giorno_preferito === "string" && ISO.test(args.giorno_preferito) ? args.giorno_preferito : undefined,
      };
      const result = proposeReschedule({ today: data.today, athlete: data.athlete, plan: data.plan, events: data.events, disruption });
      ctx.proposals = { disruption, result };
      const lines = result.proposals.map(
        (p) => `Opzione "${p.title}": ${p.summary} Modifiche: ${p.changes.map((c) => (c.op === "elimina" ? `tolta ${c.before.title} (${c.before.date})` : `${c.before.title} ${c.before.date} → ${c.after.title} ${c.after.date}, ${formatDuration(c.after.durationMin)}`)).join("; ") || "nessuna"}. Compromessi: ${p.tradeoffs.join(" ") || "nessuno"}`,
      );
      return [result.intro, result.care ? `Avviso di salute da riportare: ${result.care}` : "", ...lines, "Le opzioni sono già visibili all'atleta con il pulsante Applica."].filter(Boolean).join("\n");
    }
    default:
      return "Strumento sconosciuto.";
  }
}

export interface CoachTurn {
  reply: string;
  proposals?: { disruption: Disruption; result: RescheduleResult };
  usage: { input: number; output: number };
}

/** Un turno di conversazione: al massimo 4 giri di strumenti, poi la risposta testuale. */
export async function runCoach(opts: { client: ChatClient; model: string; data: CoachData; history: { role: "user" | "assistant"; content: string }[]; message: string }): Promise<CoachTurn> {
  const ctx: ToolContext = { data: opts.data };
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt(opts.data) },
    ...opts.history.slice(-12),
    { role: "user", content: opts.message.slice(0, 2000) },
  ];
  const usage = { input: 0, output: 0 };
  for (let round = 0; round < 5; round++) {
    const res = await opts.client({ model: opts.model, messages, tools: round < 4 ? COACH_TOOLS : undefined, max_tokens: 700, temperature: 0.3 });
    usage.input += res.usage.input;
    usage.output += res.usage.output;
    const calls = res.message.tool_calls ?? [];
    if (!calls.length) {
      return { reply: (res.message.content ?? "").trim() || "Scusa, non sono riuscito a rispondere. Riprova.", proposals: ctx.proposals, usage };
    }
    messages.push({ role: "assistant", content: res.message.content ?? null, tool_calls: calls });
    for (const c of calls) messages.push({ role: "tool", tool_call_id: c.id, content: runTool(c.function.name, c.function.arguments, ctx).slice(0, 6000) });
  }
  return { reply: "Ho bisogno di qualche dettaglio in più: puoi riformulare?", proposals: ctx.proposals, usage };
}
