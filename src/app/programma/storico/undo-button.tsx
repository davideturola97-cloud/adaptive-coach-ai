"use client";

import { Undo2 } from "lucide-react";
import { useState, useTransition } from "react";
import { undoVersion } from "@/app/riprogramma/actions";

export function UndoButton({ id }: { id: string }) {
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const [busy, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  if (msg?.ok) return <p className="text-sm text-ok">{msg.ok}</p>;
  return (
    <div className="flex flex-col gap-2">
      {!confirm ? (
        <button type="button" onClick={() => setConfirm(true)} className="inline-flex min-h-11 items-center gap-2 self-start rounded-xl border border-line px-4 text-sm font-semibold hover:border-faint">
          <Undo2 className="size-4" aria-hidden /> Annulla questa modifica
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>Ripristino il programma com&apos;era prima. Confermi?</span>
          <button type="button" onClick={() => setConfirm(false)} className="min-h-11 rounded-xl border border-line px-4 font-semibold">No</button>
          <button type="button" disabled={busy} onClick={() => start(async () => setMsg(await undoVersion(id)))} className="min-h-11 rounded-xl bg-fg px-4 font-semibold text-bg disabled:opacity-50">Sì, annulla</button>
        </div>
      )}
      {msg?.error && <p role="alert" className="text-sm text-bad">{msg.error}</p>}
    </div>
  );
}
