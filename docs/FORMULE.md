# Formule usate da Adaptive Coach AI

Ogni valore calcolato con queste formule è una **stima** e nell'app compare con l'etichetta "stimato".
Il codice è in `src/lib/training/formulas.ts`, i test in `src/lib/training/formulas.test.ts`.

| Cosa | Formula | Fonte | Limiti |
|---|---|---|---|
| Tempo su un'altra distanza | T2 = T1 × (D2 / D1)^1,06 | Riegel, 1977 | Ottimista oltre la mezza se il volume di allenamento è basso |
| VO₂max dal test di Cooper | (metri in 12' − 504,9) / 44,73 ml/kg/min | Cooper, 1968 | Dipende da quanto bene si dosa lo sforzo |
| Ritmo di soglia corsa (5 km, risultato recente, Cooper) | tempo equivalente sui 10 km (Riegel) ÷ 10 × 1,04 | Approssimazione interna | Per il Cooper la distanza è sotto i 3 km: stima meno precisa |
| Ritmo CSS nuoto (test 400 + 200 m) | (T400 − T200) ÷ 2 secondi per 100 m | Wakayoshi, 1992 | Richiede due prove a tutta ben dosate |
| Ritmo CSS da un risultato recente | tempo equivalente sui 1500 m (Riegel) ÷ 15 | Approssimazione interna | L'esponente 1,06 è nato per la corsa |
| Ritmo aerobico nuoto | CSS + 8 / + 15 secondi per 100 m | Uso comune negli allenamenti di triathlon | Indicativo |
| FTP dal test di 20' | 95% della potenza media | Allen e Coggan | Sovrastima chi ha molta capacità anaerobica |
| FTP dal ramp test | 75% della miglior potenza di 1' | Convenzione dei ramp test diffusi | Varia col protocollo della rampa |
| Zone di potenza | Z1 < 55%, Z2 56–75%, Z3 76–90%, Z4 91–105%, Z5 106–120%, Z6 > 120% della FTP | Coggan | — |
| Carico di una seduta | minuti × RPE (1–10) | Foster, session-RPE | Soggettivo; utile per i confronti nel tempo |
| Stato del carico | carico ultimi 7 giorni ÷ (carico ultimi 28 giorni ÷ 4) | Rapporto acuto/cronico | Indicatore grezzo: non predice infortuni da solo |

Soglie usate per lo stato del carico: sotto 0,8 "basso", 0,8–1,3 "equilibrato", 1,3–1,5 "in crescita", oltre 1,5 "alto".
Sono indicative e non sono una valutazione medica.

## Scelta dei test iniziali

| Sport | Principiante | Intermedio / avanzato | Sempre disponibile |
|---|---|---|---|
| Corsa | Test di Cooper (12') | Test dei 5 km | Risultato recente |
| Ciclismo | Ramp test | Test FTP 20' | FTP già conosciuta |
| Nuoto | Test CSS, solo se nuota 400 m di fila | Test CSS | Risultato recente |
| Palestra | Nessun test: carichi regolati con l'RPE | | |

Rimandare un test (1 o 2 settimane), lasciarlo programmare al sistema o rifiutarlo per 4 settimane non blocca il programma:
l'app continua con gli ultimi parametri affidabili o, se non ce ne sono, con l'RPE.

Il giorno scelto in automatico è un giorno di allenamento disponibile, ad almeno 2 giorni da oggi, mai nei 7 giorni prima
di una gara A o B né nei 4 giorni dopo.

Prima di un test massimale l'atleta risponde a 7 domande ispirate al questionario PAR-Q. Con una risposta positiva i test
massimali non si programmano finché l'atleta non dichiara il via libera del medico; restano disponibili risultati recenti e rinvii.
