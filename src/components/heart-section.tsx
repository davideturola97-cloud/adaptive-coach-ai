import { HeartPulse } from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import type { CompletedActivity } from "@/lib/domain/types";
import { heartAnalysis } from "@/lib/training/hr-pace";
import { PaceHrChart } from "./pace-hr-chart";

const pace = (s: number) => `${Math.floor(Math.round(s) / 60)}:${String(Math.round(s) % 60).padStart(2, "0")}`;
const dm = (d: string) => d.split("-").reverse().slice(0, 2).join("/");

/** Cuore e passo: grafico km per km, efficienza, deriva e confronto con le uscite simili. */
export function HeartSection({ a, history }: { a: CompletedActivity; history: CompletedActivity[] }) {
  const h = heartAnalysis(a, history);
  const chart = (a.splits ?? []).filter((s) => s.paceSec && (a.sport !== "run" || s.km >= 0.5)).map((s) => ({ n: s.n, pace: s.paceSec, hr: s.hr }));
  const hasHr = chart.some((c) => c.hr);
  if (!h && !(chart.length >= 3 && hasHr)) return null;
  const bike = a.sport === "bike";
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-3">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
        <HeartPulse className="size-4 text-bad" aria-hidden /> Cuore e {bike ? "velocità" : "passo"}
      </p>
      {chart.length >= 3 && hasHr && <PaceHrChart data={chart} bike={bike} />}
      {h && (
        <>
          <ul className="list-disc space-y-1 pl-4 text-sm text-muted">{h.findings.map((f) => <li key={f}>{f}</li>)}</ul>
          {h.similar.length >= 2 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <caption className="mb-1 text-left text-xs text-faint">Uscite simili (distanza ±25%, ultimi 4 mesi)</caption>
                <thead className="text-left text-xs text-muted">
                  <tr><th className="py-1 font-medium">Data</th><th className="py-1 font-medium">Km</th><th className="py-1 font-medium">{bike ? "km/h" : "Passo"}</th><th className="py-1 font-medium">FC</th><th className="py-1 text-right font-medium">Efficienza</th></tr>
                </thead>
                <tbody>
                  {h.similar.map((r) => (
                    <tr key={r.id} className={clsx("border-t border-line", r.current && "font-semibold text-fg")}>
                      <td className="py-1">{r.current ? "Questa" : <Link href={`/attivita/${r.id}`} className="underline">{dm(r.date)}</Link>}</td>
                      <td className="py-1">{r.distanceKm.toLocaleString("it-IT", { maximumFractionDigits: 1 })}</td>
                      <td className="py-1">{bike ? (3600 / r.paceSec).toFixed(1).replace(".", ",") : pace(r.paceSec)}</td>
                      <td className="py-1">{r.avgHr ?? "–"}</td>
                      <td className="py-1 text-right">{r.ef ? r.ef.toFixed(2).replace(".", ",") : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-1 text-xs text-faint">Efficienza = {h.efUnit}: più alta vuol dire più strada a parità di battiti (stima).</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
