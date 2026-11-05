"use client";

import { RotateCcw, XCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { quickRestore, quickSkip } from "@/app/allenamenti/actions";

/** Annulla la seduta con un tocco (e una conferma), senza motivo. Subito dopo si può ripristinare. */
export function QuickSkip({ workoutId, disabled, skipped }: { workoutId: string; disabled?: boolean; skipped?: boolean }) {
  const [state, setState] = useState<"idle" | "confirm" | "done">(skipped ? "done" : "idle");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  if (state === "done") {
    return (
      <p role="status" className="flex flex-wrap items-center gap-3 text-sm text-muted">
        Seduta annullata.
        <button type="button" disabled={pending} onClick={() => start(async () => { const r = await quickRestore(workoutId); if (r.ok) setState("idle"); else setError(r.error); })} className="inline-flex items-center gap-1 font-semibold text-fg underline">
          <RotateCcw className="size-3.5" aria-hidden /> Ripristina
        </button>
      </p>
    );
  }
  if (state === "confirm") {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm">Annullare questa seduta?</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={pending} onClick={() => start(async () => { const r = await quickSkip(workoutId); if (r.ok) setState("done"); else { setError(r.error); setState("idle"); } })} className="min-h-11 rounded-xl border border-bad/50 bg-bad/10 text-sm font-semibold text-bad">
            {pending ? "..." : "Sì, annulla"}
          </button>
          <button type="button" onClick={() => setState("idle")} className="min-h-11 rounded-xl border border-line text-sm font-semibold">No</button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <button type="button" disabled={disabled} onClick={() => setState("confirm")} className="inline-flex min-h-10 items-center gap-1.5 self-start rounded-xl px-2 text-sm font-semibold text-muted hover:text-bad disabled:opacity-50">
        <XCircle className="size-4" aria-hidden /> Annulla seduta
      </button>
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
    </div>
  );
}
