import type { PlannedWorkout, Sport, WorkoutStructure, WorkoutType } from "@/lib/domain/types";

/**
 * Modelli di seduta usati SOLO per i dati dimostrativi della Milestone 1.
 * Il vero motore di programmazione arriva con la Milestone 4.
 */
type Template = Omit<PlannedWorkout, "id" | "date" | "status" | "completedActivityId">;

const SAFETY_RUN = ["Interrompi la seduta in caso di dolore acuto, vertigini o dolore al petto."];
const SAFETY_BIKE = ["Casco sempre. Su strada evita le parti intense nel traffico.", "Interrompi in caso di dolore acuto, vertigini o dolore al petto."];

function step(label: string, durationMin: number, rpe: [number, number], note?: string, repeat?: number) {
  return { label, durationMin, rpe, note, repeat };
}

export function template(type: WorkoutType, scale = 1): Template {
  const m = (min: number) => Math.round((min * scale) / 5) * 5;
  const run = (t: Omit<Template, "sport">): Template => ({ sport: "run" as Sport, ...t });
  const bike = (t: Omit<Template, "sport">): Template => ({ sport: "bike" as Sport, ...t });
  const s = (warm: number, main: WorkoutStructure["main"], cool: number, recoveries?: string): WorkoutStructure => ({
    warmup: [step("Riscaldamento progressivo", warm, [2, 3])],
    main,
    recoveries,
    cooldown: [step("Defaticamento", cool, [1, 2])],
  });

  switch (type) {
    case "ripetute":
      return run({
        type, title: "Ripetute 6 × 3'", objective: "Migliorare la capacità aerobica massima e l'economia di corsa.",
        durationMin: 55, intensity: "Alta (RPE 8)",
        structure: s(15, [step("Ripetuta", 3, [7, 8], "Ritmo che sapresti tenere per circa 15–20 minuti in gara", 6)], 10, "2' di corsa lentissima o camminata tra le ripetute"),
        technicalTips: ["Mantieni la stessa velocità in tutte le ripetute: l'ultima non deve essere più lenta.", "Busto alto, passo corto e rapido."],
        safetyNotes: SAFETY_RUN,
      });
    case "corsa_facile":
      return run({
        type, title: "Corsa facile", objective: "Costruire la base aerobica senza accumulare fatica.",
        durationMin: m(45), intensity: "Bassa (RPE 3–4)",
        structure: s(5, [step("Corsa continua", m(35), [3, 4], "Devi riuscire a parlare in frasi complete")], 5),
        technicalTips: ["Se il battito sale troppo in salita, cammina senza problemi."],
        safetyNotes: SAFETY_RUN,
      });
    case "lungo":
      return run({
        type, title: "Lungo", objective: "Abituare il corpo alla durata della gara.",
        durationMin: m(90), intensity: "Bassa-moderata (RPE 4–5)",
        structure: s(10, [step("Corsa continua", m(70), [4, 5], "Ultimi 10' leggermente più svelti se ti senti bene")], 10),
        technicalTips: ["Prova l'integrazione che userai in gara: acqua ogni 20–25 minuti."],
        safetyNotes: [...SAFETY_RUN, "Porta acqua se fa caldo."],
      });
    case "tempo_run":
      return run({
        type, title: "Tempo run 2 × 12'", objective: "Alzare il ritmo che sostieni a lungo (soglia).",
        durationMin: 55, intensity: "Medio-alta (RPE 6–7)",
        structure: s(15, [step("Blocco a ritmo controllato", 12, [6, 7], "Impegnativo ma controllato, frasi brevi", 2)], 10, "3' di corsa facile tra i blocchi"),
        technicalTips: ["Parti prudente: il secondo blocco deve venire uguale o migliore del primo."],
        safetyNotes: SAFETY_RUN,
      });
    case "progressivo":
      return run({
        type, title: "Progressivo", objective: "Imparare a chiudere in crescendo.",
        durationMin: m(50), intensity: "Da bassa a medio-alta (RPE 3→7)",
        structure: s(10, [step("Tre terzi", m(35), [3, 7], "Ogni terzo un po' più svelto del precedente")], 5),
        technicalTips: ["L'aumento è graduale, non uno scatto finale."],
        safetyNotes: SAFETY_RUN,
      });
    case "recupero_corsa":
      return run({
        type, title: "Corsa di recupero", objective: "Favorire il recupero attivo.",
        durationMin: 30, intensity: "Molto bassa (RPE 2–3)",
        structure: s(5, [step("Corsa molto lenta", 20, [2, 3])], 5),
        technicalTips: ["Deve sembrare quasi troppo facile."],
        safetyNotes: SAFETY_RUN,
      });
    case "test_corsa":
      return run({
        type, title: "Test 5 km", objective: "Aggiornare i ritmi di allenamento.",
        durationMin: 50, distanceKm: 5, intensity: "Massimale (RPE 9–10)",
        structure: s(20, [step("5 km a tutta, ritmo regolare", 25, [9, 10])], 10),
        technicalTips: ["Percorso piatto, senza semafori.", "Parti leggermente sotto il ritmo che pensi di tenere."],
        safetyNotes: [...SAFETY_RUN, "Fai il test solo se sei in salute, riposato e senza dolori."],
      });
    case "endurance":
      return bike({
        type, title: "Endurance", objective: "Sviluppare la resistenza aerobica in bici.",
        durationMin: m(75), intensity: "Bassa (RPE 3–4)",
        structure: s(10, [step("Pedalata continua", m(60), [3, 4], "Cadenza 85–95 rpm")], 5),
        technicalTips: ["Pedalata rotonda, evita di spingere rapporti duri in salita."],
        safetyNotes: SAFETY_BIKE,
      });
    case "recupero_bici":
      return bike({
        type, title: "Pedalata di recupero", objective: "Smaltire la fatica.",
        durationMin: 45, intensity: "Molto bassa (RPE 2)",
        structure: s(5, [step("Agile e leggero", 35, [1, 2])], 5),
        technicalTips: ["Rapporti agili, niente salite impegnative."],
        safetyNotes: SAFETY_BIKE,
      });
    case "tempo_bici":
      return bike({
        type, title: "Tempo 3 × 12'", objective: "Aumentare la resistenza a ritmo sostenuto.",
        durationMin: 75, intensity: "Media (RPE 5–6)",
        structure: s(15, [step("Blocco tempo", 12, [5, 6], undefined, 3)], 10, "5' agili tra i blocchi"),
        technicalTips: ["Resta seduto e regolare."],
        safetyNotes: SAFETY_BIKE,
      });
    case "sweet_spot":
      return bike({
        type, title: "Sweet spot 3 × 12'", objective: "Alzare la FTP con un carico sostenibile.",
        durationMin: m(90), intensity: "Medio-alta (RPE 6–7)",
        structure: s(15, [step("Blocco sweet spot", 12, [6, 7], "Appena sotto la soglia", 3)], 15, "5' agili tra i blocchi"),
        technicalTips: ["Ideale sui rulli o su una strada lunga e senza incroci."],
        safetyNotes: SAFETY_BIKE,
      });
    case "soglia":
      return bike({
        type, title: "Soglia 2 × 15'", objective: "Lavorare alla FTP.",
        durationMin: 75, intensity: "Alta (RPE 7–8)",
        structure: s(15, [step("Blocco a soglia", 15, [7, 8], undefined, 2)], 10, "5' agili tra i blocchi"),
        technicalTips: ["Potenza costante: niente picchi all'inizio."],
        safetyNotes: SAFETY_BIKE,
      });
    case "vo2max":
      return bike({
        type, title: "VO₂max 5 × 3'", objective: "Aumentare la potenza aerobica massima.",
        durationMin: 60, intensity: "Molto alta (RPE 8–9)",
        structure: s(15, [step("Ripetuta", 3, [8, 9], undefined, 5)], 10, "3' agilissimi tra le ripetute"),
        technicalTips: ["Meglio sui rulli o in salita costante."],
        safetyNotes: SAFETY_BIKE,
      });
    case "test_ftp":
      return bike({
        type, title: "Test FTP 20'", objective: "Stimare la FTP e aggiornare le zone.",
        durationMin: 60, intensity: "Massimale (RPE 9–10)",
        structure: s(20, [step("20' alla massima potenza sostenibile", 20, [9, 10])], 15),
        technicalTips: ["Serve un misuratore di potenza o un rullo smart."],
        safetyNotes: [...SAFETY_BIKE, "Fai il test solo se sei in salute, riposato e senza dolori."],
      });
  }
}
