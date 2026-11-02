import { AlertTriangle, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import type { Signal } from "@/lib/training/feedback";

/** Segnali dai feedback: richiami alla prudenza, mai diagnosi. */
export function Signals({ signals, registerHref }: { signals: Signal[]; registerHref?: string }) {
  if (!signals.length) return null;
  return (
    <div className="flex flex-col gap-2">
      {signals.map((s) => {
        const body = (
          <div className={`flex gap-3 rounded-2xl border px-4 py-3 ${s.id === "registrare" ? "border-warn/40 bg-warn/5" : "border-bad/40 bg-bad/5"}`}>
            {s.id === "registrare" ? <ClipboardCheck className="mt-0.5 size-5 shrink-0 text-warn" aria-hidden /> : <AlertTriangle className="mt-0.5 size-5 shrink-0 text-bad" aria-hidden />}
            <div className="min-w-0">
              <p className="font-semibold">{s.title}</p>
              <p className="text-sm text-muted">{s.detail}</p>
            </div>
          </div>
        );
        return s.id === "registrare" && registerHref ? <Link key={s.id} href={registerHref} className="block">{body}</Link> : <div key={s.id}>{body}</div>;
      })}
      {signals.some((s) => s.id !== "registrare") && (
        <p className="text-xs text-faint">Indicazioni basate sui tuoi feedback: non sono una valutazione medica.</p>
      )}
    </div>
  );
}
