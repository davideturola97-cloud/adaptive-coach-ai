import { CheckCircle2, Link2Off } from "lucide-react";
import { disconnectStrava } from "@/app/strava/actions";
import type { StravaStatus } from "@/lib/strava/service";
import { StravaImport, STRAVA_ORANGE } from "./strava";
import { Card } from "./ui";

const ESITO: Record<string, { ok: boolean; text: string }> = {
  collegato: { ok: true, text: "Strava collegato. Ora importa le tue attività." },
  scollegato: { ok: true, text: "Strava scollegato: l'accesso è stato revocato e i token cancellati. Le attività già importate restano." },
  negato: { ok: false, text: "Hai annullato l'autorizzazione su Strava: nessun collegamento creato." },
  permessi: { ok: false, text: "Su Strava serve lasciare la spunta su \"Visualizza i dati delle tue attività\": riprova e non toglierla." },
  scaduto: { ok: false, text: "Il collegamento è scaduto o è stato aperto da un'altra finestra. Riprova." },
  limite: { ok: false, text: "Strava limita le richieste in questo momento: riprova tra 15 minuti." },
  database: { ok: false, text: "Non riesco a salvare il collegamento. Hai eseguito lo script 0009_strava.sql su Supabase?" },
  "non-configurato": { ok: false, text: "Strava non è configurato sul server." },
  errore: { ok: false, text: "Collegamento non riuscito. Riprova tra poco." },
};

/** Collegamento a Strava nel Profilo: collega, importa, scollega. */
export function StravaSection({ status, esito, demo }: { status: StravaStatus | null; esito?: string; demo: boolean }) {
  const e = esito ? ESITO[esito] : undefined;
  return (
    <Card className="flex flex-col gap-3">
      {e && <p role="status" className={`text-sm ${e.ok ? "text-ok" : "text-bad"}`}>{e.text}</p>}
      {demo || !status ? (
        <p className="text-sm text-muted">Il collegamento a Strava è disponibile quando accedi con il tuo account.</p>
      ) : !status.configured ? (
        <p className="text-sm text-muted">
          Per collegare Strava servono <code>STRAVA_CLIENT_ID</code> e <code>STRAVA_CLIENT_SECRET</code> nella configurazione del server
          (in <code>.env.local</code> sul PC e nelle Environment Variables di Vercel). La guida è in <code>docs/STRAVA.md</code>.
        </p>
      ) : !status.connected ? (
        <>
          <p className="text-sm text-muted">
            Importa corse, uscite in bici, nuotate e palestra con durata, distanza, frequenza cardiaca, potenza misurata e intertempi.
            L&apos;app legge soltanto: non pubblica e non modifica nulla su Strava.
          </p>
          {/* Link normale (non un modulo): porta alla pagina di autorizzazione di Strava. */}
          <a href="/api/strava/connect" className="inline-flex min-h-12 items-center gap-2 self-start rounded-xl px-5 text-sm font-semibold text-white" style={{ background: STRAVA_ORANGE }}>
            Collega Strava
          </a>
        </>
      ) : (
        <>
          <p className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="size-4 text-ok" aria-hidden /> Collegato{status.athleteName ? ` come ${status.athleteName}` : ""}
          </p>
          <p className="text-xs text-muted">
            {status.lastImportAt
              ? `Ultimo import: ${new Date(status.lastImportAt).toLocaleString("it-IT", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" })}.`
              : "Il primo import prende le attività degli ultimi 30 giorni."}
          </p>
          {status.broken ? (
            <p className="text-sm text-bad">Il collegamento non è più valido (chiave cambiata sul server): scollega e ricollega Strava.</p>
          ) : (
            <StravaImport />
          )}
          <form action={disconnectStrava}>
            <button className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted hover:bg-surface-2">
              <Link2Off className="size-4" aria-hidden /> Scollega Strava
            </button>
          </form>
        </>
      )}
      <p className="text-xs text-faint">Dati forniti da Strava. Compatibile con Strava.</p>
    </Card>
  );
}
