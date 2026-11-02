"use client";

import { useActionState, useState } from "react";
import { clearPlan, type PreviewState } from "./actions";

export function ClearPlan() {
  const [state, action, pending] = useActionState<PreviewState>(clearPlan, {});
  const [confirm, setConfirm] = useState(false);
  if (state.saved) return <p role="status" className="rounded-xl border border-ok/40 bg-ok/10 px-4 py-3 text-sm text-ok">{state.saved}</p>;
  return (
    <div className="flex flex-col gap-2">
      {!confirm ? (
        <button type="button" onClick={() => setConfirm(true)} className="min-h-11 self-start rounded-xl px-3 text-sm font-semibold text-bad hover:bg-bad/10">
          Cancella il programma futuro
        </button>
      ) : (
        <form action={action} className="flex flex-col gap-2 rounded-xl border border-bad/40 bg-bad/10 p-3 text-sm">
          <p>Tolgo tutte le sedute da oggi in poi. Quelle già fatte restano. Confermi?</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setConfirm(false)} className="min-h-11 rounded-xl border border-line bg-surface font-semibold">Annulla</button>
            <button disabled={pending} className="min-h-11 rounded-xl bg-bad font-semibold text-white disabled:opacity-50">{pending ? "Cancello..." : "Sì, cancella"}</button>
          </div>
        </form>
      )}
      {state.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
    </div>
  );
}
