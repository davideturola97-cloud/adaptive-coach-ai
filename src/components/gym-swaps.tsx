"use client";

import { ArrowRight, RotateCcw, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { applyGymSwaps } from "@/app/allenamenti/actions";
import { undoVersion } from "@/app/riprogramma/actions";

export interface SwapView {
  index: number;
  from: string;
  to: string | null;
  why: string;
}

/** Proposte di sostituzione: l'atleta tiene quelle che vuole e conferma. Vale solo per questa seduta, si può annullare. */
export function GymSwapsCard({ workoutId, reasons, swaps, demo }: { workoutId: string; reasons: string[]; swaps: SwapView[]; demo: boolean }) {
  const [picked, setPicked] = useState<Set<number>>(new Set(swaps.map((s) => s.index)));
  const [msg, setMsg] = useState<{ ok?: string; error?: string; versionId?: string } | null>(null);
  const [pending, start] = useTransition();
  const toggle = (i: number) => setPicked((p) => { const n = new Set(p); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-gym/40 bg-gym-soft p-4">
      <p className="flex items-center gap-2 font-semibold"><Sparkles className="size-4 text-gym" aria-hidden /> Il coach consiglia di adattare la seduta</p>
      <p className="text-sm text-muted">Perché: {reasons.join("; ")}.</p>
      {!msg?.ok && (
        <ul className="flex flex-col gap-2">
          {swaps.map((s) => (
            <li key={s.index}>
              <label className="flex cursor-pointer gap-3 rounded-xl bg-surface p-3">
                <input type="checkbox" checked={picked.has(s.index)} onChange={() => toggle(s.index)} className="mt-1 size-5 shrink-0 accent-ok" />
                <span className="flex flex-col gap-1 text-sm">
                  <span className="flex flex-wrap items-center gap-1.5 font-medium">
                    <span className="text-muted line-through decoration-faint">{s.from}</span>
                    <ArrowRight className="size-3.5 text-faint" aria-hidden />
                    <span>{s.to ?? "salta l'esercizio oggi"}</span>
                  </span>
                  <span className="text-xs text-muted">{s.why}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {msg?.error && <p role="alert" className="text-sm text-bad">{msg.error}</p>}
      {msg?.ok ? (
        <p role="status" className="flex flex-wrap items-center gap-3 text-sm text-ok">
          {msg.ok}
          {msg.versionId && (
            <button type="button" onClick={() => start(async () => { const r = await undoVersion(msg.versionId!); setMsg("ok" in r ? { ok: r.ok } : { error: r.error }); })} className="inline-flex items-center gap-1 font-semibold underline">
              <RotateCcw className="size-3.5" aria-hidden /> Annulla
            </button>
          )}
        </p>
      ) : (
        <button type="button" disabled={pending || demo || !picked.size} onClick={() => start(async () => setMsg(await applyGymSwaps(workoutId, [...picked])))} className="min-h-12 rounded-xl bg-fg font-semibold text-bg disabled:opacity-50">
          {pending ? "Aggiorno..." : picked.size === swaps.length ? "Applica a questa seduta" : `Applica le ${picked.size} scelte`}
        </button>
      )}
      {demo && <p className="text-xs text-muted">In modalità dimostrativa il programma non si modifica.</p>}
    </div>
  );
}
