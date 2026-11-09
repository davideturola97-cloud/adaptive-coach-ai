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

## Riprogrammazione (src/lib/planning/reschedule.ts)

Il motore propone, l'atleta sceglie: niente cambia senza conferma. Ogni modifica crea una versione che si può annullare.

| Imprevisto | Opzioni proposte |
|---|---|
| Non posso allenarmi / viaggio | Spostare le sedute importanti nel giorno sicuro più vicino (fino a 3 giorni prima o 4 dopo, eventualmente al posto di una facile); oppure toglierle |
| Poco tempo | Accorciare (le ripetute perdono ripetizioni, mai intensità); scambiare con una seduta facile di un altro giorno; riposo |
| Stanchezza | Alleggerire (dura → facile, −30%); rimandare la seduta dura; riposo |
| Dolore | Togliere l'intensità per 3 giorni (solo se leggero); sostituire con un altro sport facile; riposo. Sempre l'invito a sentire un medico se non passa |
| Malattia | Stop nei giorni di malattia e rientro con 3 giorni facili; oppure solo stop |
| Seduta saltata | Le facili non si recuperano; le importanti solo se c'è un giorno sicuro |

Regole verificate su ogni proposta (e su 400 imprevisti casuali nei test): nessuna seduta nei giorni bloccati,
nessuna seduta dura vicino a una gara, mai due sedute dure in giorni consecutivi, carico totale mai superiore a quello previsto.
Una seduta importante spostata in un'altra settimana si accorcia del 20%.
Se l'atleta indica un giorno preciso, quella proposta compare per prima se rispetta le regole (in quel caso i giorni disponibili
del profilo non contano, perché è l'atleta a dire che può); altrimenti il coach spiega il motivo e propone alternative.

## Intertempi (src/lib/training/splits.ts)

Calcolati sui parziali completi (l'ultimo, se più corto, si mostra ma non entra nei confronti). Servono almeno 3 parziali.

- **Andamento**: seconda metà più veloce di almeno 5 s/km = progressione; più lenta di almeno 8 s/km = calo; altrimenti regolare.
- **Regolarità**: oscillazione (deviazione standard / media) sotto il 2% = molto costante, sopra il 5% = variabile (non nelle ripetute).
- **Calo finale**: media degli ultimi 2 km più lenta di almeno 10 s/km rispetto alla media.
- **Ripetute**: frazioni veloci (almeno 15 s/km sotto la mediana) uniformi se lo scarto massimo è entro 6 s/km.
- **Seduta facile** (con soglia da test): km più veloci di soglia × 1,2 (lungo × 1,15) meno 5 s sono segnalati come troppo veloci.
- **Deriva cardiaca**: a ritmo stabile, battito della seconda metà più alto di almeno il 5%.
- Dagli screenshot: passi al miglio o ai 100 m convertiti al km; passi impossibili scartati, mai stimati. Se c'è il tempo del parziale si usa quello (più preciso del passo arrotondato).
- **Nuoto**: vasche e tratti in metri (25, 50, 100, 400…); un valore da 10 in su è sempre in metri. Le righe da 0 m si scartano.
  Le vasche più lente di 1,6 × il passo tipico (primo quartile) contengono una pausa e non entrano nei confronti;
  quelle più veloci di 0,6 × sono considerate errori di rilevamento. Soglie: progressione 2 s/100 m, calo 3 s/100 m.
  Una distanza totale oltre 20 km letta per il nuoto è in metri.
- **Totali dagli intertempi** (screenshot): distanza = somma dei parziali; durata = somma di passo × km (solo se ogni parziale ha il passo);
  passo medio = durata ÷ distanza; FC media pesata sul tempo di ogni parziale. Prevalgono sul riepilogo letto; differenze oltre il 3%
  (4% per la FC) vengono segnalate. Se i parziali coprono meno del 90% della distanza del riepilogo, la tabella è considerata tagliata
  e si tiene il riepilogo.

## Analisi della seduta (src/lib/training/analysis.ts)

Per ogni sport, anche senza intertempi. Regole fisse; i valori legati ai test sono stime.

- **Percorso** (corsa e bici): dislivello ÷ km. Sotto 5 m/km pianeggiante, 5–10 ondulato, 10–20 collinare, oltre di montagna.
- **Bici**: velocità media; potenza media ÷ FTP e zona di Coggan; W/kg se c'è il peso; oltre 2 ore promemoria su cibo e acqua.
  In una seduta di endurance una media oltre il 75% della FTP è segnalata come alta. Senza potenza: FC e RPE.
- **Corsa**: passo ÷ soglia. Da 1,15 in su facile, 1,05–1,15 medio, 0,97–1,05 vicino alla soglia, sotto sopra la soglia.
  In una seduta facile un passo sotto soglia × 1,15 (lungo × 1,12) è segnalato come veloce.
- **Nuoto**: passo per 100 m rispetto al CSS (entro 3 s ritmo CSS, entro 10 s aerobico sostenuto, oltre facile).
- **Seduta prevista**: durata sotto l'80% o sopra il 120% segnalata; RPE oltre ±1 dall'intervallo previsto segnalato.
- **Storico**: velocità o passo e FC media confrontati con la media delle ultime 6 uscite dello stesso sport (servono almeno 3).
  Differenze sotto 0,5 km/h, 3 s/km (o /100 m) o 4 battiti sono considerate nella norma.
- **Carico**: minuti × RPE.
- Intertempi in bici: velocità in km/h, parziali anche da 5 km (lap); conta come completo un parziale lungo almeno il 90% del più lungo.

## Previsioni di gara (src/lib/training/predictions.ts)

Stime dei tempi su 5 km, 10 km, mezza e maratona, ricalcolate a ogni corsa registrata o importata.

- **Riferimenti** (ultime 12 settimane): corse di almeno 3 km; dagli intertempi al km, i tratti consecutivi più veloci
  da 3, 5, 10 e 21,1 km; il ritmo di soglia del test (10 km ≈ soglia ÷ 1,04 × 10).
- **Proiezione**: Riegel T2 = T1 × (D2/D1)^e. Scendendo di distanza e = 1,06. Salendo: +0,03 sotto 20 km/settimana,
  +0,015 tra 20 e 35; per la maratona +0,03 con lungo massimo (ultime 8 settimane) sotto 21 km, +0,015 sotto 28;
  per la mezza +0,015 con lungo sotto 12 km. Un riferimento vale solo se è lungo almeno 1/8 della gara.
- **Scelta**: la proiezione più veloce tra i riferimenti validi.
- **Affidabilità**: alta = sforzo massimale o quasi (RPE ≥ 8, test) negli ultimi 60 giorni e lungo almeno 1/4 della gara;
  media = solo una delle due condizioni; bassa = altrimenti, e sempre per la maratona con lungo massimo sotto 28 km.
  Intervallo: −1%/+2% (alta), −2%/+4% (media), −3,5%/+7% (bassa).
- **Andamento**: confronto con la stessa previsione calcolata 4 settimane fa.
- Limiti: senza corse a tutta le previsioni sono prudenti (lo dicono); caldo, percorso e alimentazione in gara non sono considerati.

## Passi al km nelle sedute di corsa (src/lib/training/run-paces.ts)

Calcolati quando si apre la seduta (non salvati): seguono la forma attuale.
Riferimento T (ritmo di soglia, s/km): il test degli ultimi 4 mesi; se una previsione dai 10 km con affidabilità media o alta
nasce da una corsa più recente del test, vale quella (T = passo previsto sui 10 km × 1,04). Senza riferimento: solo RPE.

| Fase | Passo (multipli di T, dal più veloce al più lento) |
|---|---|
| Riscaldamento | 1,25 – 1,40 |
| Corsa facile | 1,20 – 1,32 |
| Lungo | 1,15 – 1,27 |
| Recupero | 1,30 – 1,45 |
| Tempo run (soglia) | 0,99 – 1,03 |
| Ripetute | 0,92 – 0,96 (con i metri attesi per ripetuta) |
| Recuperi tra ripetute o blocchi | 1,35 – 1,55 |
| Progressivo | terzi a 1,25 → 1,12 → 1,02 |
| Test 5 km | partenza 5 s/km più lenta del passo previsto sui 5 km |
| Defaticamento | 1,28 – 1,45 |

Arrotondati a 5 secondi. Sono indicazioni: con caldo, salite o stanchezza comanda l'RPE.

## Sedute come un allenatore (src/lib/planning/library.ts, progression.ts)

- **Libreria**: ogni tipo di lavoro ha una scala di livelli. Corsa: VO₂max (6 × 2' → 4 × 1600 m), ritmo 10 km, soglia
  (3 × 8' → 3 × 4 km), ritmo mezza (3 × 2 km → 3 × 5 km), fartlek, salite brevi. Bici: tempo, sweet spot, soglia, VO₂max.
  Nuoto: CSS, velocità. Ripetute a tempo o a distanza, scelte dal livello.
- **Recuperi proporzionati**: VO₂max e ritmo 10 km circa metà della frazione corricchiando; soglia e ritmo mezza 1/5–1/4;
  salite: discesa al passo; fartlek: corsa facile.
- **Livello di partenza** (ultimi 60 giorni): ultima seduta dello stesso tipo chiusa con RPE entro il previsto → +1;
  RPE di 1 sopra → stesso livello; 2 o più sopra → −1; saltata → stesso livello (−1 se due volte di fila);
  senza RPE → +1. Mai visto → livello 1/2/3 per principiante/intermedio/avanzato. Poi +1 a ogni seduta in programma;
  scarico e settimana di gara: due livelli sotto. Il livello scende se la seduta supera la durata massima.
- **Scelta per fase e gara**: base = fartlek o salite (+ soglia se c'è una seconda qualità); costruzione per la mezza =
  soglia + VO₂max/ritmo 10 km, nelle ultime 6 settimane ritmo mezza; per 5–10 km = VO₂max + soglia/ritmo 10 km;
  rifinitura = ritmo gara; scarico = soglia leggera; settimana di gara = breve richiamo al ritmo gara.
  Seconda seduta di qualità solo per lo sport della gara con almeno 5 sedute a settimana.
- **Lungo con finale a ritmo gara** a settimane alterne in costruzione e rifinitura per mezza e maratona (10', poi +5').
- **Allunghi** (6 × 20″) in una corsa facile a settimana in base e costruzione.
- **Volume dai dati reali**: media delle ultime 4 settimane (con almeno 4 attività), +8% al massimo a settimana;
  scarico al 70% dell'ultima settimana di carico. Lungo: dal più lungo delle ultime 6 settimane, +10' (corsa) o +15' (bici).
- **Frequenza minima**: gli sport della gara almeno 2 volte a settimana (corsa 3 per una gara di corsa).
- **Settimana**: le sedute dure si piazzano cercando la combinazione migliore di giorni (mai consecutive);
  il nuoto di qualità non conta come seduta dura; la palestra va dopo una seduta di qualità, mai alla vigilia.

## Tre obiettivi di gara (raceGoals in predictions.ts)

Miglioramento realistico g = 0,4% per settimana di preparazione (esclusa l'ultima), massimo 4%, dimezzato con affidabilità bassa.
Sicuro = estremo lento della previsione; possibile = previsione × (1 − g/2); ambizioso = previsione × (1 − g) × 0,985.

## Scheda di palestra a giorni fissi (src/lib/training/gym-schedule.ts)

L'atleta sceglie giorni, gruppi muscolari e durata (Profilo → Scheda di palestra). Il motore la rispetta:
la palestra va nei giorni scelti e non toglie tempo alla resistenza; il giorno dopo gambe pesanti o total body
non si mettono sedute chiave di corsa o bici (ripetute, soglia, lungo, test); nella settimana di gara, nei 4 giorni
prima, le gambe diventano parte alta o mobilità. Consigli (prossime 2 settimane):

- gambe il giorno prima di una seduta chiave → spostarle lo stesso giorno di una seduta di qualità (dopo) o in un giorno
  senza seduta chiave il giorno dopo; in alternativa 2 serie leggere;
- gambe a 1–4 giorni da una gara A/B → solo parte alta o mobilità; il giorno prima della gara → saltare;
- gambe il giorno dopo il lungo → carichi moderati; spalle/dorsali il giorno prima di nuoto di qualità → leggere;
- scheda: due sedute di gambe pesanti → una diventa richiamo leggero; nessuna seduta di gambe con corsa o bici → aggiungerla;
  niente core → 10' di core; 4 o più giorni → serie lontane dal cedimento.

## Progressione dei carichi in palestra (src/lib/training/gym-progress.ts)

Dopo ogni seduta di palestra si registrano carico, ripetizioni e se tutte le serie sono riuscite (modulo già compilato).
Doppia progressione: si sale quando tutte le serie riescono al massimo delle ripetizioni previste per 2 sedute di fila
(1 se le ripetizioni sono un numero fisso). Aumento +2,5 kg (parte alta, esercizi piccoli), +5 kg (squat, stacchi, leg press,
hip thrust), arrotondato a 2,5 kg. Due sedute di fila non riuscite: −5%. Gara A entro 3 settimane: carichi delle gambe invariati.

## Oggi: controllo del mattino (src/lib/training/readiness.ts)

Sonno 1–5, fatica 1–5, dolori (nessuno/leggero/forte). Dolore forte → stop su quella seduta e invito a sentire un medico
o un fisioterapista se non passa in 2–3 giorni; dolore leggero → togliere l'intensità (proposta "dolore");
fatica 5, oppure sonno ≤ 2 e fatica ≥ 4, oppure 3 mattine di fila con fatica ≥ 4, con una seduta dura → proposta
"alleggerisci" del motore di riprogrammazione, applicabile con un tocco e annullabile. Non è una valutazione medica.

## Revisione della settimana (src/lib/planning/weekly-review.ts)

Da sabato a lunedì. Guarda gli ultimi 7 giorni: sedute fatte/saltate, sedute con RPE di 2 o più sopra il previsto,
sonno e fatica medi, giorni con fastidi. Settimana pesante (2+ sedute troppo dure, fatica media ≥ 3,8 o fastidi in 2+ giorni)
o meno del 60% delle sedute fatte → prossima settimana −15% di volume. Il resto del programma si rigenera con la storia
reale (livelli delle sedute, volume, lunghi). Si mostrano le differenze giorno per giorno; si applica o si tiene com'è.

## Strava automatico

All'apertura dell'app, se Strava è collegato e l'ultimo import ha più di 15 minuti, le attività nuove si importano da sole
e la Home chiede subito lo sforzo percepito della più recente.

## Sostituzioni in palestra (src/lib/training/gym-swaps.ts)

Per una seduta di palestra in programma il coach guarda: seduta chiave di corsa/bici il giorno prima (o attività con RPE ≥ 7
o ≥ 80'), seduta chiave il giorno dopo, mattina con fatica ≥ 4 o fastidi alle gambe, gara A/B entro 6 giorni, nuoto di qualità
il giorno dopo. Propone: squat → leg press (una serie in meno, 10-12, RPE 6); affondi → step up basso; stacchi → ponte glutei;
polpacci → calf seduto leggero; salti → via; altri esercizi di gambe → −40% serie e −20% carico; gara entro 4 giorni → gambe via;
prima del nuoto: military press → alzate laterali leggere, trazioni → lat machine. Per gli esercizi nuovi nessun chilo inventato:
il carico è indicato con le ripetizioni di margine. L'atleta sceglie quali sostituzioni tenere; vale solo per quella seduta ed è annullabile.

## Cuore e passo (src/lib/training/hr-pace.ts)

- **Efficienza** (corsa): metri al minuto ÷ FC media = metri per battito. Bici: watt ÷ FC con il misuratore, altrimenti km/h ÷ FC.
  Confronto con la media delle ultime uscite simili (stesso sport, distanza ±25%, 4 mesi): differenze sotto il 2% = in linea.
- **A passo simile**: FC media rispetto alle uscite simili con passo entro ±10″/km (differenze sotto 3 battiti = uguale).
- **Deriva cardiaca** (Friel): efficienza della prima metà rispetto alla seconda sui parziali al km con FC (almeno 6, sedute ≥ 40').
  Sotto 5% buona resistenza aerobica, 5–10% da migliorare, oltre 10% ritmo alto per la durata, caldo o poca idratazione.
- **FC a passo fisso**: regressione lineare FC ~ velocità sui parziali al km con FC entro ±75″ dal passo di riferimento
  (passo facile = soglia × 1,25, altrimenti il 60° percentile dei passi recenti), servono almeno 8 parziali.
  Ultime 4 settimane contro le 6 precedenti: −2 battiti o più = forma aerobica in crescita, entro ±2 = stabile.

## Piano gara (src/lib/training/race-plan.ts)

Sull'obiettivo scelto (sicuro, possibile, ambizioso): primo 25% della gara a passo obiettivo + 5″/km, ultimo 20% a −3″/km
(se si sta bene), parte centrale ricalcolata perché il tempo finale torni esatto. Tempi di passaggio ogni 5 km.
Gel: nessuno sotto i 50', uno a metà tra 50' e 80', ogni 35–40' fino a 2h30, poi circa 60 g di carboidrati all'ora.
Con caldo oltre 18–20 °C: 5–10″/km più lenti.
Obiettivo scelto dall'atleta: si confronta con i tre calcolati (più lento del sicuro = facile; tra sicuro e possibile = realistico;
tra possibile e ambizioso = ambizioso; più veloce dell'ambizioso = molto difficile, con il consiglio di partire sul "possibile").

## Energia di oggi (src/lib/training/energy.ts)

Stima di mantenimento, ±10–15%; non è un consiglio medico o dietetico.
- Metabolismo a riposo (Mifflin-St Jeor): uomo 10·kg + 6,25·cm − 5·anni + 5; donna −161; non indicato −78.
- Vita quotidiana: metabolismo × 1,2 + passi medi al giorno (senza la corsa, già contata) × 0,0005 kcal per kg di peso
  (circa 0,035 kcal a passo per 70 kg). Senza passi: × 1,4.
- Prossimi giorni: stesso calcolo sulle sedute in programma dei 7 giorni successivi.
- Allenamento (calorie nette): corsa 0,95 kcal/kg/km; bici con potenza watt × secondi ÷ 1000; altrimenti (MET − 1) × kg × ore
  (Compendium of Physical Activities): bici 6/8/10,5, nuoto 6/8,3/10, palestra 3,5/5/6, corsa senza distanza 8,5/10/11,5
  per facile/media/dura (da RPE o tipo di seduta). Sedute fatte con i dati veri, quelle da fare con la durata prevista.
- Ripartizione: proteine 1,6 g/kg (1,8 nei giorni intensi e di gara); carboidrati 3 g/kg riposo, 4,5 leggera, 5,5 moderata,
  7–8 intensa, 8 alla vigilia di una gara lunga, 7 il giorno di gara; grassi il resto, almeno 0,8 g/kg. Se i carboidrati non
  ci stanno, si riducono; alla vigilia e il giorno di gara invece si tengono e il totale sale un po'.

## Sforzo delle corse senza RPE (predictions.ts)

FC massima: la più alta vista in 12 settimane, oppure Tanaka (208 − 0,7 × età) se quella vista è sotto il 92% della formula.
Una corsa con FC media ≥ 90% della massima (almeno 15') vale come sforzo duro, come RPE ≥ 8 o un test.
Le altre sono sforzi parziali: "più lente del massimo" di un fattore 1,05 (FC ≥ 86%), 1,10 (≥ 80%), 1,18 (sotto), 1,07 (RPE 6–7),
1,20 (RPE ≤ 5), 1,15 senza dati. Se nelle 12 settimane c'è almeno uno sforzo duro si usano i dati così come sono (le facili
fanno solo da limite minimo); altrimenti le corse facili si correggono con quel fattore invece di essere lette come gare.
Riferimento per i passi: tra test recente (4 mesi) e previsione da uno sforzo duro vince il più veloce; una previsione
da corse facili non sostituisce mai un test recente.

## Allenarsi per migliorare (run-paces.ts: paceTargets, thresholdOn)

Verso la prossima gara di corsa con un obiettivo (il tuo, altrimenti il "possibile"):
- soglia da raggiungere = soglia di oggi × (tempo obiettivo ÷ tempo previsto), usando il più veloce tra il tuo obiettivo e il
  "possibile" (si migliora anche se l'obiettivo è facile), mai oltre l'"ambizioso" e mai più lenta di oggi;
- le sedute future usano una soglia che scende in modo lineare da oggi a quella da raggiungere, 10 giorni prima della gara
  (poi resta lì durante lo scarico); ripetute, soglia, riscaldamenti e recuperi seguono la soglia della loro data;
- le fasi a ritmo gara (ritmo mezza per una mezza, ritmo 10 km per un 10 km, ritmo maratona) usano il passo del tuo obiettivo ±3″/km;
- facili e lunghi seguono la stessa soglia ma nelle loro fasce tranquille: correrli più forte non fa migliorare.
- Obiettivo e struttura: salto = (previsione − obiettivo) ÷ previsione. Con un salto ≥ 1% il lavoro a ritmo gara comincia
  8 settimane prima della gara invece di 6; con un salto ≥ 2% ogni lungo in costruzione e rifinitura ha il finale a ritmo gara.
  Nel piano gara si può scegliere sicuro, possibile o ambizioso come obiettivo con un tocco.

## Corsa in km

Le fasi continue a tempo (riscaldamento, corsa facile, lungo, finali, defaticamento, progressivo) si mostrano in km:
durata ÷ passo medio della loro fascia (alla soglia della data della seduta), arrotondati al mezzo km; la durata resta
indicata tra parentesi. Ripetute invariate. Distanza totale della seduta = somma delle fasi (≈, stimata).
Ripetute a tempo: ogni frazione diventa una distanza al passo medio della sua fascia, arrotondata a 50 m sotto il km e a 100 m
sopra (es. 6 × 3' → 6 × 700 m); anche il titolo. Recuperi: circa i metri corrispondenti alla durata al passo del recupero.
Le salite restano a tempo (il passo in salita non conta).
