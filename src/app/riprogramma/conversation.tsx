"use client";

import clsx from "clsx";
import { ArrowRight, Bot, HeartPulse, RotateCcw, Undo2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { SportDot } from "@/components/ui";
import { addDays, formatDayMonth, weekdayName } from "@/lib/dates";
import { SPORTS } from "@/lib/domain/sports";
import type { Sport } from "@/lib/domain/types";
import type { Brief, Change, Disruption, DisruptionKind, Proposal, RescheduleResult } from "@/lib/planning/reschedule";
import { formatDuration } from "@/lib/training/formulas";
import { applyProposal, getProposals, undoVersion } from "./actions";

const KINDS: { kind: DisruptionKind; label: string; hint: string }[] = [
  { kind: "nessun_allenamento", label: "Non posso allenarmi", hint: "Un impegno, una cena, il lavoro" },
  { kind: "poco_tempo", label: "Ho poco tempo", hint: "Posso fare qualcosa, ma meno" },
  { kind: "stanco", label: "Sono stanco", hint: "Gambe pesanti, poco sonno" },
  { kind: "dolore", label: "Ho un dolore", hint: "Un fastidio o un infortunio" },
  { kind: "malato", label: "Sono malato", hint: "Influenza, febbre, raffreddore" },
  { kind: "viaggio", label: "Sono in viaggio", hint: "Più giorni senza possibilità" },
];

const RANGE: DisruptionKind[] = ["malato", "viaggio"];
const day = (d: string) => `${weekdayName(d).toLowerCase()} ${formatDayMonth(d, false)}`;

export function Coach({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex max-w-[95%] gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-run to-bike"><Bot className="size-4 text-white" aria-hidden /></span>
      <div className="min-w-0 rounded-2xl rounded-tl-md border border-line bg-surface px-4 py-3 text-sm leading-relaxed">{children}</div>
    </div>
  );
}

export function Me({ children }: { children: React.ReactNode }) {
  return <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-surface-2 px-4 py-3 text-sm">{children}</p>;
}

function Choice({ onClick, children, sub, disabled }: { onClick: () => void; children: React.ReactNode; sub?: string; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="flex min-h-12 flex-col items-start justify-center rounded-xl border border-line bg-surface px-4 py-2 text-left hover:border-faint disabled:opacity-50">
      <span className="text-sm font-semibold">{children}</span>
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </button>
  );
}

function BriefLine({ b }: { b: Brief }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <SportDot sport={b.sport} />
      <span className="truncate">{weekdayName(b.date, true)} {formatDayMonth(b.date)} · {b.title} · {formatDuration(b.durationMin)}</span>
    </span>
  );
}

function ChangeRow({ c }: { c: Change }) {
  return (
    <li className="flex flex-col gap-1 border-b border-line py-2.5 text-sm last:border-0">
      <div className="grid gap-1 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-3">
        <span className={clsx("min-w-0", c.op !== "modifica" && "text-muted")}><BriefLine b={c.before} /></span>
        <ArrowRight className="hidden size-4 text-faint sm:block" aria-hidden />
        {c.op === "elimina" ? <span className="font-semibold text-bad">Tolta</span> : <span className="min-w-0 font-medium"><BriefLine b={c.after} /></span>}
      </div>
      <span className="text-xs text-muted">{c.note}</span>
    </li>
  );
}

export function ProposalCard({ p, onApply, busy, demo }: { p: Proposal; onApply: () => void; busy: boolean; demo: boolean }) {
  return (
    <article className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-5">
      <div>
        <h3 className="text-base font-bold">{p.title}</h3>
        <p className="mt-1 text-sm text-muted">{p.summary}</p>
      </div>
      {p.changes.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-faint">Prima → dopo</p>
          <ul>{p.changes.map((c) => <ChangeRow key={`${c.op}-${c.id}`} c={c} />)}</ul>
        </div>
      )}
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="font-semibold">Perché</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted">{p.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="font-semibold">Compromessi</p>
          {p.tradeoffs.length ? <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted">{p.tradeoffs.map((r) => <li key={r}>{r}</li>)}</ul> : <p className="mt-1 text-muted">Nessuno di rilievo.</p>}
        </div>
      </div>
      <button type="button" onClick={onApply} disabled={busy || demo} className="min-h-12 rounded-xl bg-ok text-sm font-semibold text-bg disabled:opacity-50">
        {p.changes.length ? "Applica questa soluzione" : "Va bene così"}
      </button>
    </article>
  );
}

export function RescheduleConversation({ today, sports, demo, start }: { today: string; sports: Sport[]; demo: boolean; start?: { from?: string; workoutId?: string; workoutTitle?: string; skipped?: boolean } }) {
  const [kind, setKind] = useState<DisruptionKind | null>(start?.skipped ? "saltata" : null);
  const [from, setFrom] = useState<string | null>(start?.skipped ? (start.from ?? today) : null);
  const [to, setTo] = useState<string>(start?.from ?? today);
  const [rangeFrom, setRangeFrom] = useState<string>(start?.from ?? today);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [painSport, setPainSport] = useState<Sport | null>(null);
  const [severe, setSevere] = useState<boolean | null>(null);
  // undefined = non ancora chiesto, null = "scegli tu", data = giorno scelto dall'atleta
  const [preferred, setPreferred] = useState<string | null | undefined>(undefined);
  const [result, setResult] = useState<RescheduleResult | { error: string } | null>(null);
  const [applied, setApplied] = useState<{ ok?: string; error?: string; versionId?: string; title?: string } | null>(null);
  const [undone, setUndone] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const disruption = (): Disruption | null => {
    if (!kind || !from) return null;
    return {
      kind, from,
      to: RANGE.includes(kind) ? to : undefined,
      availableMin: kind === "poco_tempo" ? (minutes ?? undefined) : undefined,
      painSport: kind === "dolore" ? (painSport ?? undefined) : undefined,
      painSevere: kind === "dolore" ? Boolean(severe) : undefined,
      workoutId: kind === "saltata" ? start?.workoutId : undefined,
      preferredDate: preferred ?? undefined,
    };
  };
  const asksDay = kind !== null && ["nessun_allenamento", "viaggio", "poco_tempo", "stanco"].includes(kind);
  const detailsDone = kind === "poco_tempo" ? minutes !== null : kind === "dolore" ? painSport !== null && severe !== null : true;
  const ready = Boolean(kind && from && detailsDone && (!asksDay || preferred !== undefined));

  const ask = () => {
    const d = disruption();
    if (!d) return;
    startTransition(async () => setResult(await getProposals(d)));
  };
  const apply = (p: Proposal) => {
    const d = disruption();
    if (!d) return;
    startTransition(async () => {
      const r = await applyProposal(d, p.id);
      setApplied("error" in r ? { error: r.error } : { ok: r.ok, versionId: r.versionId, title: p.title });
    });
  };
  const undo = () => {
    if (!applied?.versionId) return;
    startTransition(async () => {
      const r = await undoVersion(applied.versionId!);
      setUndone("error" in r ? r.error : r.ok);
    });
  };
  const reset = () => {
    setKind(null); setFrom(null); setMinutes(null); setPainSport(null); setSevere(null); setPreferred(undefined); setResult(null); setApplied(null); setUndone(null);
  };

  // Le proposte si calcolano appena la conversazione ha tutti i dati.
  useEffect(() => {
    if (ready && !result) ask();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- si ricalcola solo quando la conversazione è completa
  }, [ready, result]);

  const kindLabel = KINDS.find((k) => k.kind === kind)?.label ?? "Ho saltato una seduta";

  return (
    <div className="flex flex-col gap-4">
      <Coach>
        {start?.workoutTitle ? <>Parliamo di <strong>{start.workoutTitle}</strong>. </> : null}
        {start?.skipped ? "Vedo che l'hai saltata. Vediamo se conviene recuperarla." : "Cosa succede?"}
      </Coach>

      {!kind && (
        <div className="grid gap-2 sm:grid-cols-2">
          {KINDS.map((k) => <Choice key={k.kind} sub={k.hint} onClick={() => setKind(k.kind)}>{k.label}</Choice>)}
        </div>
      )}
      {kind && kind !== "saltata" && <Me>{kindLabel}</Me>}

      {kind && kind !== "saltata" && (
        <>
          <Coach>{RANGE.includes(kind) ? "Da che giorno a che giorno?" : kind === "dolore" ? "Da quando?" : "Quando?"}</Coach>
          {!from && !RANGE.includes(kind) && (
            <div className="flex flex-wrap gap-2">
              {(start?.from && start.from >= today ? [start.from] : []).concat([today, addDays(today, 1), addDays(today, 2)]).filter((d, i, a) => a.indexOf(d) === i).map((d) => (
                <Choice key={d} onClick={() => setFrom(d)}>{d === today ? "Oggi" : d === addDays(today, 1) ? "Domani" : day(d)}</Choice>
              ))}
              <label className="flex min-h-12 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm">
                Altro giorno
                <input type="date" min={today} onChange={(e) => e.target.value && setFrom(e.target.value)} className="bg-transparent" />
              </label>
            </div>
          )}
          {!from && RANGE.includes(kind) && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 text-sm">Dal<input type="date" min={today} value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} className="min-h-12 rounded-xl border border-line bg-surface px-3" /></label>
              <label className="flex flex-col gap-1 text-sm">Al<input type="date" min={rangeFrom} value={to < rangeFrom ? rangeFrom : to} onChange={(e) => setTo(e.target.value)} className="min-h-12 rounded-xl border border-line bg-surface px-3" /></label>
              <button type="button" onClick={() => { if (to < rangeFrom) setTo(rangeFrom); setFrom(rangeFrom); }} className="min-h-12 rounded-xl bg-fg px-5 text-sm font-semibold text-bg">Ok</button>
            </div>
          )}
          {from && <Me>{RANGE.includes(kind) ? `Dal ${formatDayMonth(from, false)} al ${formatDayMonth(to < from ? from : to, false)}` : from === today ? "Oggi" : day(from)}</Me>}
        </>
      )}

      {from && kind === "poco_tempo" && (
        <>
          <Coach>Quanti minuti hai?</Coach>
          {minutes === null ? (
            <div className="flex flex-wrap gap-2">{[15, 20, 30, 45, 60, 90].map((m) => <Choice key={m} onClick={() => setMinutes(m)}>{m} minuti</Choice>)}</div>
          ) : <Me>{minutes} minuti</Me>}
        </>
      )}

      {from && kind === "dolore" && (
        <>
          <Coach>Quale sport ti fa male?</Coach>
          {painSport === null ? (
            <div className="flex flex-wrap gap-2">{sports.map((s) => <Choice key={s} onClick={() => setPainSport(s)}>{SPORTS[s].label}</Choice>)}</div>
          ) : <Me>{SPORTS[painSport].label}</Me>}
          {painSport !== null && (
            <>
              <Coach>Quanto è forte?</Coach>
              {severe === null ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Choice sub="Fastidio che non cambia il modo in cui mi muovo" onClick={() => setSevere(false)}>Leggero</Choice>
                  <Choice sub="Mi fa zoppicare o peggiora con lo sforzo" onClick={() => setSevere(true)}>Forte</Choice>
                </div>
              ) : <Me>{severe ? "Forte" : "Leggero"}</Me>}
            </>
          )}
        </>
      )}

      {asksDay && from && detailsDone && (
        <>
          <Coach>Hai un giorno in cui preferiresti spostare l&apos;allenamento? Se no, scelgo io il più adatto.</Coach>
          {preferred === undefined ? (
            <div className="flex flex-wrap items-center gap-2">
              <Choice onClick={() => setPreferred(null)}>Scegli tu</Choice>
              <label className="flex min-h-12 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm">
                Il giorno
                <input type="date" min={addDays(today, 1)} onChange={(e) => e.target.value && setPreferred(e.target.value)} className="bg-transparent" />
              </label>
            </div>
          ) : <Me>{preferred ? day(preferred) : "Scegli tu"}</Me>}
        </>
      )}

      {busy && !result && <Coach>Ci penso un attimo...</Coach>}

      {result && "error" in result && <Coach><span className="text-bad">{result.error}</span></Coach>}
      {result && !("error" in result) && (
        <>
          <Coach>{result.intro}</Coach>
          {result.care && (
            <div className="flex gap-3 rounded-2xl border border-bad/40 bg-bad/5 px-4 py-3 text-sm">
              <HeartPulse className="mt-0.5 size-5 shrink-0 text-bad" aria-hidden />
              <p>{result.care} <span className="text-muted">Il coach non fa diagnosi.</span></p>
            </div>
          )}
          {!applied && result.proposals.map((p) => <ProposalCard key={p.id} p={p} onApply={() => apply(p)} busy={busy} demo={demo} />)}
          {demo && !applied && result.proposals.length > 0 && <p className="text-sm text-muted">In modalità dimostrativa le proposte non si applicano.</p>}
        </>
      )}

      {applied && (
        <>
          {applied.title && <Me>{applied.title}</Me>}
          <Coach>
            {applied.error ? <span className="text-bad">{applied.error}</span> : (
              <>
                {applied.ok} <Link href="/calendario" className="font-semibold underline">Vedi il calendario</Link>.
              </>
            )}
          </Coach>
          {applied.versionId && !undone && (
            <button type="button" onClick={undo} disabled={busy} className="inline-flex min-h-11 items-center gap-2 self-start rounded-xl border border-line px-4 text-sm font-semibold hover:border-faint">
              <Undo2 className="size-4" aria-hidden /> Annulla questa modifica
            </button>
          )}
          {undone && <Coach>{undone}</Coach>}
        </>
      )}

      {(kind || result) && (
        <button type="button" onClick={reset} className="inline-flex min-h-11 items-center gap-2 self-start rounded-xl px-3 text-sm font-semibold text-muted hover:text-fg">
          <RotateCcw className="size-4" aria-hidden /> Ricomincia
        </button>
      )}
    </div>
  );
}
