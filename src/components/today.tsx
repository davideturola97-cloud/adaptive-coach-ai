"use client";

import clsx from "clsx";
import { CheckCircle2, CloudDownload, Octagon, RotateCcw, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { applyTodayProposal, applyWeeklyReview, autoImportStrava, saveCheckin, skipWeeklyReview, type CheckinState, type TodayProposal } from "@/app/oggi/actions";
import { undoVersion } from "@/app/riprogramma/actions";
import type { CheckIn, ReadinessAdvice } from "@/lib/training/readiness";

const SLEEP = ["", "Malissimo", "Male", "Così così", "Bene", "Benissimo"];
const FATIGUE = ["", "Fresco", "Normale", "Un po' stanco", "Stanco", "Distrutto"];

function Scale({ name, labels, value, onChange, legend }: { name: string; labels: string[]; value?: number; onChange: (n: number) => void; legend: string }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer">
            <input type="radio" name={name} value={n} checked={value === n} onChange={() => onChange(n)} className="peer sr-only" />
            <span className="flex min-h-12 flex-col items-center justify-center rounded-xl border border-line text-center text-[11px] leading-tight text-muted peer-checked:border-fg peer-checked:bg-fg peer-checked:text-bg peer-focus-visible:outline peer-focus-visible:outline-2">
              <b className="text-base">{n}</b>
              {labels[n]}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const STATUS = {
  "via libera": { icon: CheckCircle2, cls: "border-ok/40 bg-ok/10 text-ok" },
  attenzione: { icon: TriangleAlert, cls: "border-warn/40 bg-warn/10 text-warn" },
  stop: { icon: Octagon, cls: "border-bad/40 bg-bad/10 text-bad" },
} as const;

function Advice({ advice, proposal, demo }: { advice: ReadinessAdvice; proposal?: TodayProposal; demo: boolean }) {
  const [msg, setMsg] = useState<{ ok?: string; error?: string; versionId?: string } | null>(null);
  const [pending, start] = useTransition();
  const S = STATUS[advice.status];
  return (
    <div className={clsx("flex flex-col gap-3 rounded-2xl border p-4", S.cls)}>
      <p className="flex gap-2 text-sm"><S.icon className="mt-0.5 size-5 shrink-0" aria-hidden /><span className="text-fg">{advice.text}</span></p>
      {proposal && advice.disruption && !msg?.ok && (
        <div className="flex flex-col gap-2 rounded-xl bg-surface p-3 text-sm text-fg">
          <p className="font-semibold">Proposta del coach: {proposal.title}</p>
          <p className="text-muted">{proposal.summary}</p>
          <button
            type="button"
            disabled={pending || demo}
            onClick={() => start(async () => setMsg(await applyTodayProposal(advice.disruption!, proposal.id)))}
            className="min-h-12 rounded-xl bg-fg font-semibold text-bg disabled:opacity-50"
          >
            {pending ? "Aggiorno..." : "Va bene, applica"}
          </button>
          {demo && <p className="text-xs text-muted">In modalità dimostrativa il programma non si modifica.</p>}
        </div>
      )}
      {msg?.error && <p role="alert" className="text-sm text-bad">{msg.error}</p>}
      {msg?.ok && (
        <p role="status" className="flex flex-wrap items-center gap-3 text-sm text-ok">
          {msg.ok}
          {msg.versionId && (
            <button type="button" onClick={() => start(async () => { const r = await undoVersion(msg.versionId!); setMsg("ok" in r ? { ok: r.ok } : { error: r.error }); })} className="inline-flex items-center gap-1 font-semibold underline">
              <RotateCcw className="size-3.5" aria-hidden /> Annulla
            </button>
          )}
        </p>
      )}
    </div>
  );
}

/** Controllo del mattino: 3 domande, poi il consiglio del coach per oggi. */
export function MorningCheckin({ existing, advice, proposal, demo }: { existing?: CheckIn; advice?: ReadinessAdvice; proposal?: TodayProposal; demo: boolean }) {
  const [state, action, pending] = useActionState<CheckinState, FormData>(saveCheckin, null);
  const [edit, setEdit] = useState(!existing);
  const [sleep, setSleep] = useState(existing?.sleep);
  const [fatigue, setFatigue] = useState(existing?.fatigue);
  const [pain, setPain] = useState<CheckIn["pain"]>(existing?.pain ?? "nessuno");
  const shown = state?.advice ?? (!edit ? advice : undefined);
  const shownProposal = state?.advice ? state.proposal : proposal;

  if (shown && !edit) {
    return (
      <div className="flex flex-col gap-2">
        <Advice advice={shown} proposal={shownProposal} demo={demo} />
        <button type="button" onClick={() => setEdit(true)} className="self-start text-xs font-semibold text-muted underline">Cambia le risposte</button>
      </div>
    );
  }
  return (
    <form action={(fd) => { setEdit(false); action(fd); }} className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4">
      <p className="font-semibold">Come stai stamattina?</p>
      <Scale name="sleep" legend="Come hai dormito?" labels={SLEEP} value={sleep} onChange={setSleep} />
      <Scale name="fatigue" legend="Quanto sei stanco?" labels={FATIGUE} value={fatigue} onChange={setFatigue} />
      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-sm font-medium">Dolori?</legend>
        <div className="grid grid-cols-3 gap-1.5">
          {(["nessuno", "leggero", "forte"] as const).map((p) => (
            <label key={p} className="cursor-pointer">
              <input type="radio" name="pain" value={p} checked={pain === p} onChange={() => setPain(p)} className="peer sr-only" />
              <span className="flex min-h-11 items-center justify-center rounded-xl border border-line text-sm capitalize text-muted peer-checked:border-fg peer-checked:bg-fg peer-checked:text-bg">{p}</span>
            </label>
          ))}
        </div>
        {pain !== "nessuno" && <input name="painWhere" maxLength={100} defaultValue={existing?.painWhere} placeholder="Dove? (es. polpaccio destro)" className="min-h-11 rounded-xl border border-line bg-bg px-3 text-base outline-none focus:border-faint" />}
      </fieldset>
      {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      <button disabled={pending || !sleep || !fatigue} className="min-h-12 rounded-xl bg-ok text-base font-semibold text-bg disabled:opacity-50">
        {pending ? "Un attimo..." : "Invia le risposte"}
      </button>
    </form>
  );
}

/** Import automatico da Strava quando si apre l'app (al massimo ogni 15 minuti). */
export function StravaAutoSync() {
  const router = useRouter();
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    autoImportStrava()
      .then((r) => {
        if (!alive || !r) return;
        if (r.imported > 0) {
          setN(r.imported);
          router.refresh();
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [router]);
  if (!n) return null;
  return (
    <p role="status" className="flex items-center gap-2 rounded-xl border border-ok/40 bg-ok/10 px-4 py-3 text-sm text-ok">
      <CloudDownload className="size-5 shrink-0" aria-hidden />
      {n === 1 ? "1 attività importata" : `${n} attività importate`} da Strava. Aggiungi lo sforzo percepito qui sotto.
    </p>
  );
}

/** Revisione della settimana: com'è andata, cosa cambia, conferma con un tocco. */
export function WeeklyReviewCard({ target, summary, decision, changes, demo }: { target: string; summary: string[]; decision: string; changes: { day: string; before: string; after: string }[]; demo: boolean }) {
  const [msg, setMsg] = useState<{ ok?: string; error?: string; versionId?: string } | null>(null);
  const [pending, start] = useTransition();
  if (msg?.ok && !msg.versionId) return <p role="status" className="text-sm text-ok">{msg.ok}</p>;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-run/40 bg-gradient-to-br from-run/10 to-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-run">Revisione della settimana</p>
      {summary.length > 0 && <ul className="flex flex-col gap-1 text-sm text-muted">{summary.map((s) => <li key={s}>{s}</li>)}</ul>}
      <p className="text-sm font-medium">{decision}</p>
      {changes.length > 0 && (
        <ul className="flex flex-col gap-1.5 text-sm">
          {changes.map((c) => (
            <li key={c.day} className="rounded-xl bg-surface px-3 py-2">
              <b>{c.day}</b>: <span className="text-muted line-through decoration-faint">{c.before}</span> → {c.after}
            </li>
          ))}
        </ul>
      )}
      {msg?.error && <p role="alert" className="text-sm text-bad">{msg.error}</p>}
      {msg?.ok ? (
        <p role="status" className="flex flex-wrap items-center gap-3 text-sm text-ok">
          {msg.ok}
          <button type="button" onClick={() => start(async () => { const r = await undoVersion(msg.versionId!); setMsg("ok" in r ? { ok: r.ok } : { error: r.error }); })} className="inline-flex items-center gap-1 font-semibold underline">
            <RotateCcw className="size-3.5" aria-hidden /> Annulla
          </button>
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={pending || demo || !changes.length} onClick={() => start(async () => setMsg(await applyWeeklyReview(target)))} className="min-h-12 rounded-xl bg-fg text-sm font-semibold text-bg disabled:opacity-50">
            {pending ? "Aggiorno..." : changes.length ? "Applica" : "Niente da cambiare"}
          </button>
          <button type="button" disabled={pending || demo} onClick={() => start(async () => setMsg(await skipWeeklyReview(target)))} className="min-h-12 rounded-xl border border-line text-sm font-semibold disabled:opacity-50">
            Tieni com&apos;è
          </button>
        </div>
      )}
      {demo && <p className="text-xs text-muted">In modalità dimostrativa il programma non si modifica.</p>}
    </div>
  );
}
