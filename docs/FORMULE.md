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

## Motore di programmazione (src/lib/planning)

Regole fisse, senza AI: con gli stessi dati produce sempre lo stesso programma.

- **Fasi** in base alla prossima gara A o B: base (oltre 8 settimane), costruzione (8–4), rifinitura (3–2, solo gare A),
  scarico (la settimana prima di una gara A), gara, recupero (la settimana dopo una gara A).
  Nei periodi di base e costruzione la quarta settimana è di scarico.
- **Volume**: ore disponibili × livello (0,7 principiante, 0,8 intermedio, 0,88 avanzato) × fase
  (base 0,85, costruzione 1, rifinitura 0,9, scarico 0,65, gara e recupero 0,5). Mai più del 15% in più
  rispetto alla settimana di carico precedente; la prima settimana è ridotta del 10%.
- **Ripartizione** verso la gara obiettivo: mezza o corsa 65% corsa, 22% bici, 13% nuoto; bici 68/18/14;
  triathlon sprint/olimpico 22% nuoto, 42% bici, 36% corsa; medio/lungo 18/50/32. Solo tra gli sport praticati.
- **Sedute dure** per settimana: base 1–2, costruzione 2–3, rifinitura 2, scarico e gara 1, recupero 0.
  Mai due sedute dure in giorni consecutivi (contano anche lunghi e test, anche a cavallo tra due settimane).
- **Lunghi** nei giorni scelti (default sabato e domenica): bici o combinato nel primo, corsa nell'ultimo.
  Il lungo cresce al massimo di 15 minuti a settimana.
- **Gare**: giorno della gara libero, il giorno prima solo attivazione, 1–2 giorni liberi dopo.
- **Palestra**: 1–2 sedute in base e costruzione, 1 in rifinitura e recupero, nessuna in scarico e gara;
  evitata il giorno prima di una seduta dura.
- **Intensità**: RPE. Ritmi (corsa), watt (bici) e passi in vasca (nuoto) compaiono solo se esiste un parametro da test,
  sempre etichettati "stimato". I principianti senza test non fanno ripetute o tempo run nelle prime 3 settimane.

## Feedback e segnali (src/lib/training/feedback.ts)

- **Duplicati**: un'attività è considerata la stessa se ha stesso sport, stesso giorno e durata entro il 10% (minimo 5 minuti).
  L'app chiede conferma prima di salvarla; il database rifiuta anche due attività con la stessa impronta
  (sport, giorno, durata arrotondata a 5 minuti) salvo conferma esplicita.
- **Segnali**: un singolo feedback non genera mai un avviso. Servono episodi ripetuti:
  dolore indicato in almeno 2 sedute in 14 giorni; RPE di almeno 2 punti sopra il previsto in 3 delle ultime 5 sedute;
  sonno 1–2 su 5 in almeno 3 sedute in 7 giorni. I testi suggeriscono prudenza e, per il dolore persistente,
  di sentire un medico o un fisioterapista. Non sono diagnosi.
