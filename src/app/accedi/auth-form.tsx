"use client";

import clsx from "clsx";
import { useActionState, useState } from "react";
import { signIn, signUp, type AuthState } from "./actions";

export function AuthForm({ linkError }: { linkError: boolean }) {
  const [mode, setMode] = useState<"accedi" | "registrati">("accedi");
  const [loginState, login, loggingIn] = useActionState<AuthState, FormData>(signIn, {});
  const [signupState, signup, signingUp] = useActionState<AuthState, FormData>(signUp, {});
  const state = mode === "accedi" ? loginState : signupState;
  const pending = loggingIn || signingUp;

  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" className="grid grid-cols-2 rounded-xl border border-line bg-surface p-1">
        {(["accedi", "registrati"] as const).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={clsx("min-h-11 rounded-lg text-sm font-semibold capitalize", mode === m ? "bg-surface-2 text-fg" : "text-muted")}>
            {m}
          </button>
        ))}
      </div>

      {linkError && !state.error && !state.message && (
        <p className="rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">Il link di conferma non è valido o è scaduto. Accedi, oppure registrati di nuovo.</p>
      )}

      <form action={mode === "accedi" ? login : signup} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Email
          <input id="email" name="email" type="email" autoComplete="email" required className="min-h-12 rounded-xl border border-line bg-surface px-4 text-base outline-none focus:border-fg" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Password
          <input id="password" name="password" type="password" minLength={8} required autoComplete={mode === "accedi" ? "current-password" : "new-password"} className="min-h-12 rounded-xl border border-line bg-surface px-4 text-base outline-none focus:border-fg" />
          {mode === "registrati" && <span className="text-xs font-normal text-muted">Almeno 8 caratteri.</span>}
        </label>
        {mode === "registrati" && (
          <label className="flex items-start gap-3 text-sm text-muted">
            <input id="consent" name="consent" type="checkbox" required className="mt-1 size-5 accent-run" />
            Acconsento al trattamento dei miei dati di allenamento e salute per far funzionare il coach. Posso esportarli o cancellarli in qualsiasi momento dal Profilo.
          </label>
        )}

        {state.error && <p role="alert" className="rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-bad">{state.error}</p>}
        {state.message && <p role="status" className="rounded-xl border border-ok/40 bg-ok/10 px-4 py-3 text-sm text-ok">{state.message}</p>}

        <button type="submit" disabled={pending} className="min-h-12 rounded-xl bg-fg text-base font-semibold text-bg disabled:opacity-60">
          {pending ? "Attendi..." : mode === "accedi" ? "Accedi" : "Crea account"}
        </button>
      </form>
    </div>
  );
}
