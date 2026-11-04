"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setRaceGoal } from "@/app/profilo/gare/actions";

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
      <label className="text-sm font-medium" htmlFor="goal">Il mio obiettivo</label>
      <div className="flex gap-2">
        <input
          id="goal"
          inputMode="numeric"
          placeholder="es. 1:39:00"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={8}
          className="min-h-12 w-36 rounded-xl border border-line bg-bg px-3 text-lg tabular-nums outline-none focus:border-faint"
        />
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
