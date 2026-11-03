"use client";

import clsx from "clsx";
import Link from "next/link";
import { useState, useTransition } from "react";
import { quickDone, quickRpe } from "@/app/allenamenti/actions";

const HINT = ["", "Riposo", "Molto facile", "Facile", "Comodo", "Moderato", "Impegnativo", "Duro", "Molto duro", "Quasi al massimo", "Massimo"];

/** Dieci pulsanti: un tocco e lo sforzo percepito è salvato. */
function RpeRow({ onPick, pending, disabled }: { onPick: (n: number) => void; pending: boolean; disabled?: boolean }) {
  const [hover, setHover] = useState<number>();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            disabled={pending || disabled}
            onClick={() => onPick(n)}
            onPointerEnter={() => setHover(n)}
            onPointerLeave={() => setHover(undefined)}
            aria-label={`RPE ${n}: ${HINT[n]}`}
            className={clsx("min-h-12 rounded-xl border text-base font-semibold disabled:opacity-50", n >= 8 ? "border-bad/40" : n >= 6 ? "border-warn/40" : "border-line", "hover:bg-fg hover:text-bg")}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="min-h-4 text-xs text-muted">{hover ? HINT[hover] : "1 = facilissima · 10 = al massimo"}</p>
    </div>
  );
}

export function QuickRpe({ activityId, detailsHref, disabled }: { activityId: string; detailsHref: string; disabled?: boolean }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<{ ok: boolean; error?: string; rpe?: number }>();
  if (res?.ok) return <p role="status" className="text-sm text-ok">Salvato: RPE {res.rpe}. <Link href={detailsHref} className="underline">Aggiungi dettagli</Link> se vuoi.</p>;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">Quanto è stata dura?</p>
      <RpeRow pending={pending} disabled={disabled} onPick={(n) => start(async () => setRes({ ...(await quickRpe(activityId, n)), rpe: n }))} />
      {res?.error && <p role="alert" className="text-sm text-bad">{res.error}</p>}
    </div>
  );
}

export function QuickDone({ plannedId, detailsHref, disabled }: { plannedId: string; detailsHref: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [res, setRes] = useState<{ ok: boolean; error?: string; rpe?: number }>();
  if (res?.ok) return <p role="status" className="rounded-xl border border-ok/40 bg-ok/10 px-4 py-3 text-sm text-ok">Fatto! RPE {res.rpe}. Bravo.</p>;
  if (!open) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setOpen(true)} disabled={disabled} className="min-h-12 rounded-xl bg-ok font-semibold text-bg disabled:opacity-50">Fatto</button>
        <Link href={detailsHref} className="flex min-h-12 items-center justify-center rounded-xl border border-line font-semibold">Dettagli</Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-ok/40 p-3">
      <p className="text-sm font-medium">Fatto come previsto? Quanto è stata dura?</p>
      <RpeRow pending={pending} disabled={disabled} onPick={(n) => start(async () => setRes({ ...(await quickDone(plannedId, n)), rpe: n }))} />
      {res?.error && <p role="alert" className="text-sm text-bad">{res.error}</p>}
      <p className="text-xs text-muted">Durata o distanza diverse? <Link href={`${detailsHref}#registra`} className="underline">Registra con i dettagli</Link>.</p>
    </div>
  );
}
