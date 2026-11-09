"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setRaceGoal } from "@/app/profilo/gare/actions";
import { TimePicker } from "./time-input";

/** Il mio obiettivo: un tempo scritto dall'atleta, salvato con la gara. */
export function RaceGoalForm({ eventId, current, demo }: { eventId: string; current?: string; demo: boolean }) {
  const [value, setValue] = useState(current ?? "");
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>();
  const [pending, start] = useTransition();
  const router = useRouter();
  const save = (v: string) =>
    start(async () => {
      const r = await setRaceGoal(eventId, v);
      setMsg(r);
      if (r.ok) router.replace(`/gara/${eventId}${v ? "?obiettivo=mio" : ""}`);
    });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(value);
      }}
      className="flex flex-col gap-2"
    >
      <p className="text-sm font-medium">Il mio obiettivo</p>
      <div className="flex flex-wrap items-start gap-2">
        <TimePicker value={value} onChange={setValue} label="Il mio obiettivo" />
        <button disabled={pending || demo} className="min-h-12 rounded-xl bg-fg px-5 font-semibold text-bg disabled:opacity-50">
          {pending ? "..." : "Salva"}
        </button>
        {current && (
          <button type="button" disabled={pending || demo} onClick={() => { setValue(""); save(""); }} className="min-h-12 rounded-xl border border-line px-4 text-sm font-semibold disabled:opacity-50">
            Togli
          </button>
        )}
      </div>
      {msg?.error && <p role="alert" className="text-sm text-bad">{msg.error}</p>}
      {msg?.ok && <p role="status" className="text-sm text-ok">{msg.ok}</p>}
      {demo && <p className="text-xs text-muted">In modalità dimostrativa non si salva.</p>}
    </form>
  );
}

/** "Scegli come mio obiettivo": salva uno dei tre obiettivi calcolati come obiettivo della gara. */
export function UseAsGoal({ eventId, label, time, demo }: { eventId: string; label: string; time: string; demo: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>();
  const router = useRouter();
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={pending || demo}
        onClick={() => start(async () => { const r = await setRaceGoal(eventId, time); setMsg(r); if (r.ok) router.replace(`/gara/${eventId}?obiettivo=mio`); })}
        className="min-h-12 rounded-xl bg-fg px-4 text-sm font-semibold text-bg disabled:opacity-50"
      >
        {pending ? "..." : `Scegli "${label}" (${time}) come mio obiettivo`}
      </button>
      {msg?.error && <p role="alert" className="text-sm text-bad">{msg.error}</p>}
    </div>
  );
}
