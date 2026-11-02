"use client";

import { useActionState, useState } from "react";
import { EventFields } from "@/components/form";
import { addEvent, type EventState } from "./actions";

export function AddEventForm({ disabled }: { disabled: boolean }) {
  const [state, action, pending] = useActionState<EventState, FormData>(addEvent, {});
  const [formKey, setFormKey] = useState(0);
  return (
    <form action={async (fd) => { await action(fd); setFormKey((k) => k + 1); }} className="flex flex-col gap-3">
      <EventFields key={formKey} />
      {state.errors && (
        <ul role="alert" className="flex flex-col gap-1 rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-bad">
          {state.errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}
      {state.ok && <p role="status" className="rounded-xl border border-ok/40 bg-ok/10 px-4 py-3 text-sm text-ok">{state.ok}</p>}
      <button disabled={pending || disabled} className="min-h-12 rounded-xl bg-fg text-sm font-semibold text-bg disabled:opacity-50">{pending ? "Salvataggio..." : "Aggiungi gara"}</button>
    </form>
  );
}
