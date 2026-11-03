"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { importStrava, type ImportState } from "@/app/strava/actions";
import { addFeedback, type FeedbackState } from "@/app/allenamenti/actions";
import { sportLabel } from "@/lib/domain/sports";
import type { Sport } from "@/lib/domain/types";
import { FeedbackFields } from "./activity-form";

export const STRAVA_ORANGE = "#FC4C02";

/** Pulsante "Importa da Strava" con il resoconto di cosa è stato importato. */
export function StravaImport({ compact }: { compact?: boolean }) {
  const [state, action, pending] = useActionState<ImportState, FormData>(importStrava, null);
  const r = state && "imported" in state ? state : null;
  return (
    <div className="flex flex-col gap-3">
      <form action={action}>
        <button
          disabled={pending}
          className="inline-flex min-h-12 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: STRAVA_ORANGE }}
        >
          <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} aria-hidden />
          {pending ? "Importo da Strava..." : compact ? "Importa da Strava" : "Importa adesso"}
        </button>
      </form>
      {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      {r && !r.error && (
        <div role="status" className="flex flex-col gap-2 rounded-xl border border-line bg-surface-2 p-3 text-sm">
          {r.imported.length === 0 ? (
            <p>Nessuna attività nuova su Strava.</p>
          ) : (
            <>
              <p className="font-semibold">Importate {r.imported.length} attività. Aggiungi lo sforzo percepito (RPE): il coach ne ha bisogno.</p>
              <ul className="flex flex-col gap-1">
                {r.imported.map((a) => (
                  <li key={a.id}>
                    <Link href={`/attivita/${a.id}`} className="underline">
                      {a.date.split("-").reverse().slice(0, 2).join("/")} · {sportLabel(a.sport as Sport)} · {a.title || "Attività"}
                    </Link>
                    {a.linked && <span className="text-ok"> · collegata al programma</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
          {r.alreadyLogged.length > 0 && (
            <p className="text-muted">
              Non importate perché le avevi già registrate a mano: {r.alreadyLogged.map((a) => `${a.title} (${a.date.split("-").reverse().slice(0, 2).join("/")})`).join(", ")}.
            </p>
          )}
          {r.unsupported > 0 && <p className="text-muted">{r.unsupported} attività di altri sport (camminate, sci...) non importate.</p>}
          {r.remaining > 0 && <p className="text-warn">Ne restano {r.remaining}: premi di nuovo tra qualche minuto (Strava limita le richieste).</p>}
        </div>
      )}
    </div>
  );
}

/** Feedback per un'attività già salvata senza feedback (tipicamente importata da Strava). */
export function AddFeedbackForm({ activityId }: { activityId: string }) {
  const [state, action, pending] = useActionState<FeedbackState, FormData>(addFeedback, {});
  if (state.saved) return <p role="status" className="text-sm text-ok">Feedback salvato. Grazie: il coach ne terrà conto.</p>;
  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="activityId" value={activityId} />
      <FeedbackFields />
      {state.errors && (
        <ul role="alert" className="flex flex-col gap-1 rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-bad">
          {state.errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}
      <button disabled={pending} className="min-h-12 rounded-xl bg-ok text-base font-semibold text-bg disabled:opacity-50">
        {pending ? "Salvataggio..." : "Salva feedback"}
      </button>
    </form>
  );
}
