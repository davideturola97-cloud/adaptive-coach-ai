# Adaptive Coach AI

Allenatore personale per corsa e ciclismo che adatta il programma alla tua settimana.

**Stato: Milestone 1.** App navigabile con dati dimostrativi. Nessun servizio esterno, nessuna credenziale.

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
| `npm test` | Esegue i test automatici delle formule e delle analisi |
| `npm run check` | Tipi, lint, test e build di produzione in sequenza |

## Struttura

```
src/
  app/                 pagine: Home, Calendario, Allenamenti, Coach AI, Progressi, Profilo
  components/          interfaccia (menu, schede, grafici, calendario)
  lib/domain/          modello dei dati (sport estendibili: per ora corsa e ciclismo)
  lib/training/        formule e analisi, con test
  lib/demo/            DATI DIMOSTRATIVI (da sostituire con Supabase nella Milestone 2)
docs/FORMULE.md        formule usate e loro limiti
```

## Milestone

1. ✅ Progetto Next.js, design, navigazione, dati dimostrativi
2. Supabase, autenticazione, profilo atleta, database
3. Onboarding e test iniziali
4. Motore di programmazione e calendario persistente
5. Completamento attività, feedback e storico
6. Riprogrammazione con regole deterministiche, anteprima e conferma
7. Integrazione AI, chat e analisi screenshot
8. Test end-to-end, sicurezza, PWA e deployment
