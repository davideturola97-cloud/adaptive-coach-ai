"use client";

import clsx from "clsx";
import { CalendarCheck, Clock, X } from "lucide-react";
import { useActionState, useState } from "react";
import { Field, inputCls } from "@/components/form";
import { SportBadge } from "@/components/ui";
import { formatDayMonth, weekdayName } from "@/lib/dates";
import type { PlannedTest, Sport, TestKind } from "@/lib/domain/types";
import { READINESS_QUESTIONS, TEST_CATALOG, TESTS_BY_SPORT } from "@/lib/training/tests";
import { changeTest, proposeTest, recordResult, saveReadiness, type TestState } from "./actions";

function Message({ state }: { state: TestState }) {
  if (state.error) return <p role="alert" className="rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-bad">{state.error}</p>;
  if (state.ok) return <p role="status" className="rounded-xl border border-ok/40 bg-ok/10 px-4 py-3 text-sm text-ok">{state.ok}</p>;
  return null;
}

const STATUS_TEXT = (t: PlannedTest) => {
  const d = t.dueDate ? `${weekdayName(t.dueDate)} ${formatDayMonth(t.dueDate, false)}` : "";
  switch (t.status) {
    case "programmato": return `Programmato per ${d}`;
    case "rimandato": return `Rimandato a ${d}`;
    case "rifiutato": return `In pausa fino a ${d}`;
    default: return "Da fare quando vuoi";
  }
};

function ResultFields({ kind }: { kind: TestKind }) {
  switch (kind) {
    case "5km": return <Field label="Tempo sui 5 km" hint="Formato mm:ss, es. 24:30"><input name="time" inputMode="numeric" placeholder="24:30" className={inputCls} /></Field>;
    case "cooper": return <Field label="Metri percorsi in 12 minuti"><input name="meters" inputMode="numeric" placeholder="2800" className={inputCls} /></Field>;
    case "recente_corsa":
      return (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Distanza (km)"><input name="distanceKm" inputMode="decimal" placeholder="21,1" className={inputCls} /></Field>
          <Field label="Tempo" hint="mm:ss o h:mm:ss"><input name="time" inputMode="numeric" placeholder="1:42:06" className={inputCls} /></Field>
        </div>
      );
    case "ftp20": return <Field label="Potenza media dei 20 minuti (W)"><input name="watts" inputMode="numeric" placeholder="250" className={inputCls} /></Field>;
    case "ramp": return <Field label="Miglior potenza di 1 minuto (W)"><input name="watts" inputMode="numeric" placeholder="320" className={inputCls} /></Field>;
    case "ftp_nota": return <Field label="La tua FTP (W)"><input name="watts" inputMode="numeric" placeholder="240" className={inputCls} /></Field>;
    case "css":
      return (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tempo 400 m" hint="mm:ss"><input name="t400" inputMode="numeric" placeholder="7:20" className={inputCls} /></Field>
          <Field label="Tempo 200 m" hint="mm:ss"><input name="t200" inputMode="numeric" placeholder="3:30" className={inputCls} /></Field>
        </div>
      );
    case "recente_nuoto":
      return (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Distanza (m)"><input name="distanceM" inputMode="numeric" placeholder="1500" className={inputCls} /></Field>
          <Field label="Tempo" hint="mm:ss"><input name="time" inputMode="numeric" placeholder="30:00" className={inputCls} /></Field>
        </div>
      );
  }
}

export function ResultForm({ sport, initialKind, today, disabled }: { sport: Sport; initialKind: TestKind; today: string; disabled?: boolean }) {
  const [state, action, pending] = useActionState<TestState, FormData>(recordResult, {});
  const [kind, setKind] = useState<TestKind>(initialKind);
  const options = TESTS_BY_SPORT[sport] ?? [];
  return (
    <form action={action} className="flex flex-col gap-3 rounded-xl bg-surface-2 p-3">
      <Field label="Che risultato hai?">
        <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as TestKind)} className={inputCls}>
          {options.map((k) => <option key={k} value={k}>{TEST_CATALOG[k].label}</option>)}
        </select>
      </Field>
      <ResultFields key={kind} kind={kind} />
      <Field label="Data della prova"><input name="date" type="date" defaultValue={today} max={today} className={inputCls} /></Field>
      <Message state={state} />
      <button disabled={pending || disabled} className="min-h-12 rounded-xl bg-fg text-sm font-semibold text-bg disabled:opacity-50">
        {pending ? "Calcolo..." : "Salva e calcola i parametri"}
      </button>
    </form>
  );
}

export function TestCard({ t, today, maximalBlocked, demo }: { t: PlannedTest; today: string; maximalBlocked: boolean; demo: boolean }) {
  const info = TEST_CATALOG[t.kind];
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<TestState, FormData>(changeTest, {});
  const btn = "flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm font-semibold hover:border-faint disabled:opacity-40";

  return (
    <article className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SportBadge sport={t.sport} />
        <span className={clsx("text-xs font-semibold", t.status === "programmato" ? "text-ok" : "text-muted")}>{STATUS_TEXT(t)}</span>
      </div>
      <div>
        <h3 className="text-lg font-bold">{info.label}</h3>
        <p className="mt-1 text-sm text-muted">{info.summary}</p>
        {t.reason && <p className="mt-1 text-sm text-muted">Perché questo test: {t.reason}</p>}
        {info.maximal && <p className="mt-2 inline-block rounded-md border border-warn/40 px-2 py-0.5 text-xs font-semibold text-warn">Sforzo massimale · circa {info.durationMin} minuti</p>}
      </div>
      <details className="text-sm">
        <summary className="min-h-8 cursor-pointer font-semibold">Come si fa</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">{info.instructions.map((i) => <li key={i}>{i}</li>)}</ol>
      </details>

      <button type="button" onClick={() => setOpen(!open)} className="min-h-12 rounded-xl bg-fg text-sm font-semibold text-bg" aria-expanded={open}>
        {open ? "Chiudi" : "Inserisci il risultato"}
      </button>
      {open && <ResultForm sport={t.sport} initialKind={t.kind} today={today} disabled={demo} />}

      <form action={action} className="grid grid-cols-2 gap-2">
        <input type="hidden" name="id" value={t.id} />
        <button name="op" value="auto" disabled={pending || demo || (info.maximal && maximalBlocked)} className={clsx(btn, "col-span-2")}>
          <CalendarCheck className="size-4" aria-hidden /> Scegli tu un giorno adatto
        </button>
        <button name="op" value="rimanda1" disabled={pending || demo} className={btn}><Clock className="size-4" aria-hidden /> Tra 1 settimana</button>
        <button name="op" value="rimanda2" disabled={pending || demo} className={btn}><Clock className="size-4" aria-hidden /> Tra 2 settimane</button>
        <button name="op" value="rifiuta" disabled={pending || demo} className={clsx(btn, "col-span-2 text-muted")}><X className="size-4" aria-hidden /> Non ora</button>
      </form>
      {info.maximal && maximalBlocked && <p className="text-xs text-warn">Per programmare un test a tutta rispondi prima alle domande di sicurezza (o serve il via libera del medico).</p>}
      <Message state={state} />
    </article>
  );
}

export function ReadinessForm({ flagged, demo }: { flagged: boolean; demo: boolean }) {
  const [state, action, pending] = useActionState<TestState, FormData>(saveReadiness, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      {READINESS_QUESTIONS.map((q) => (
        <div key={q.id} className="flex flex-col gap-2 rounded-xl border border-line p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">{q.text}</p>
          <div className="grid shrink-0 grid-cols-2 gap-2">
            {(["no", "si"] as const).map((v) => (
              <label key={v} className="cursor-pointer">
                <input type="radio" name={`q.${q.id}`} value={v} defaultChecked={v === "no"} className="peer sr-only" />
                <span className="flex min-h-11 min-w-16 items-center justify-center rounded-xl border border-line text-sm font-semibold text-muted peer-checked:border-fg peer-checked:bg-fg peer-checked:text-bg">{v === "si" ? "Sì" : "No"}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
      {flagged && (
        <label className="flex items-start gap-3 rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm">
          <input type="checkbox" name="doctorCleared" className="mt-0.5 size-5 accent-run" />
          Ho parlato con un medico e ho il via libera per sforzi massimali.
        </label>
      )}
      <Message state={state} />
      <button disabled={pending || demo} className="min-h-12 rounded-xl bg-fg text-sm font-semibold text-bg disabled:opacity-50">Salva le risposte</button>
    </form>
  );
}

export function AddTestForm({ sports, demo }: { sports: Sport[]; demo: boolean }) {
  const [state, action, pending] = useActionState<TestState, FormData>(proposeTest, {});
  const options = sports.flatMap((s) => (TESTS_BY_SPORT[s] ?? []).filter((k) => TEST_CATALOG[k].maximal));
  if (!options.length) return null;
  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Field label="Aggiungi un test">
          <select name="kind" className={inputCls}>{options.map((k) => <option key={k} value={k}>{TEST_CATALOG[k].label}</option>)}</select>
        </Field>
      </div>
      <button disabled={pending || demo} className="min-h-12 rounded-xl border border-line bg-surface px-5 text-sm font-semibold disabled:opacity-50">Aggiungi</button>
      <Message state={state} />
    </form>
  );
}
