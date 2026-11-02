# Adaptive Coach AI

Allenatore personale per corsa e ciclismo che adatta il programma alla tua settimana.

**Stato: Milestone 3.** Quattro sport (nuoto, ciclismo, corsa, palestra) e gare di triathlon. Onboarding guidato, gare, test iniziali con rinvio e controlli di sicurezza, parametri stimati. Accesso con Supabase e dati protetti per utente.
Senza configurazione Supabase l'app parte in modalità dimostrativa.

Per collegare Supabase segui `docs/SUPABASE.md`.

## Avviarla su Windows

1. Installa **Node.js LTS** da https://nodejs.org (pulsante "LTS", poi Avanti fino alla fine).
2. Fai doppio clic su **`avvia.bat`** in questa cartella.
   - La prima volta scarica le librerie (qualche minuto).
   - Poi apre il browser su http://localhost:3000.
3. Per fermarla chiudi la finestra nera.

## Comandi (per chi sviluppa)

| Comando | Cosa fa |
|---|---|
| `npm run dev` | Avvia l'app in sviluppo su http://localhost:3000 |
| `npm test` | Test automatici: formule, analisi, validazione e regole di sicurezza del database |
| `npm run check` | Tipi, lint, test e build di produzione in sequenza |

## Struttura

```
src/
  app/                 pagine: Home, Calendario, Allenamenti, Coach AI, Progressi, Profilo
  components/          interfaccia (menu, schede, grafici, calendario)
  lib/domain/          modello dei dati: sport (nuoto, bici, corsa, palestra), gare, validazione
  lib/training/        formule, analisi e logica dei test, con test automatici
  lib/data/            lettura dei dati: Supabase se configurato, altrimenti dati dimostrativi
  lib/supabase/        collegamento a Supabase (sessione, middleware)
  lib/demo/            DATI DIMOSTRATIVI
supabase/migrations/   schema del database e regole di sicurezza (RLS)
supabase/rls.test.ts   test delle regole di sicurezza su un Postgres in memoria
docs/FORMULE.md        formule usate e loro limiti
```

## Milestone

1. ✅ Progetto Next.js, design, navigazione, dati dimostrativi
2. ✅ Supabase, autenticazione, profilo atleta, database
3. ✅ Onboarding e test iniziali (con nuoto, palestra e triathlon)
4. Motore di programmazione e calendario persistente
5. Completamento attività, feedback e storico
6. Riprogrammazione con regole deterministiche, anteprima e conferma
7. Integrazione AI, chat e analisi screenshot
8. Test end-to-end, sicurezza, PWA e deployment
