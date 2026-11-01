# Formule usate da Adaptive Coach AI

Ogni valore calcolato con queste formule è una **stima** e nell'app compare con l'etichetta "stimato".
Il codice è in `src/lib/training/formulas.ts`, i test in `src/lib/training/formulas.test.ts`.

| Cosa | Formula | Fonte | Limiti |
|---|---|---|---|
| Tempo su un'altra distanza | T2 = T1 × (D2 / D1)^1,06 | Riegel, 1977 | Ottimista oltre la mezza se il volume di allenamento è basso |
| VO₂max dal test di Cooper | (metri in 12' − 504,9) / 44,73 ml/kg/min | Cooper, 1968 | Dipende da quanto bene si dosa lo sforzo |
| Ritmo di soglia da un 5 km | tempo equivalente sui 10 km (Riegel) ÷ 10 × 1,04 | Approssimazione interna | Da sostituire con un test di soglia quando disponibile |
| FTP dal test di 20' | 95% della potenza media | Allen e Coggan | Sovrastima chi ha molta capacità anaerobica |
| FTP dal ramp test | 75% della miglior potenza di 1' | Convenzione dei ramp test diffusi | Varia col protocollo della rampa |
| Zone di potenza | Z1 < 55%, Z2 56–75%, Z3 76–90%, Z4 91–105%, Z5 106–120%, Z6 > 120% della FTP | Coggan | — |
| Carico di una seduta | minuti × RPE (1–10) | Foster, session-RPE | Soggettivo; utile per i confronti nel tempo |
| Stato del carico | carico ultimi 7 giorni ÷ (carico ultimi 28 giorni ÷ 4) | Rapporto acuto/cronico | Indicatore grezzo: non predice infortuni da solo |

Soglie usate per lo stato del carico: sotto 0,8 "basso", 0,8–1,3 "equilibrato", 1,3–1,5 "in crescita", oltre 1,5 "alto".
Sono indicative e non sono una valutazione medica.
