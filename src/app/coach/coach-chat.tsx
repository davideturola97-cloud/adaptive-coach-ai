"use client";

import { Mic, MicOff, SendHorizontal, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { applyProposal, undoVersion } from "@/app/riprogramma/actions";
import { Coach, Me, ProposalCard } from "@/app/riprogramma/conversation";
import type { Proposal } from "@/lib/planning/reschedule";
import { type CoachMessage, sendCoachMessage } from "./actions";

const SUGGESTIONS = [
  "Martedì ho una cena di lavoro e non posso fare le ripetute",
  "Oggi ho solo 30 minuti",
  "Come sta andando la preparazione per la prossima gara?",
  "Perché questa settimana è più leggera?",
];

/** Dettatura vocale del browser (Chrome, Edge, Safari). Se non c'è, il pulsante non compare. */
type Recognition = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
function getRecognition(): Recognition | null {
  if (typeof window === "undefined") return null;
  const C = (window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }).SpeechRecognition
    ?? (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition;
  return C ? new C() : null;
}

function Text({ s }: { s: string }) {
  return <>{s.split("\n").map((line, i) => <p key={i} className={i ? "mt-2" : ""}>{line}</p>)}</>;
}

export function CoachChat({ conversationId, initial, enabled, demo }: { conversationId: string | null; initial: CoachMessage[]; enabled: boolean; demo: boolean }) {
  const router = useRouter();
  const [convId, setConvId] = useState(conversationId);
  const [messages, setMessages] = useState<CoachMessage[]>(initial);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<Record<string, { ok?: string; error?: string; versionId?: string; undone?: string }>>({});
  const [listening, setListening] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const [busy, start] = useTransition();
  const rec = useRef<Recognition | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCanSpeak(Boolean(getRecognition()));
  }, []);
  // Le graffe servono: nei browser recenti scrollIntoView restituisce una Promise, che un effetto non deve restituire.
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  const send = (value = text) => {
    const v = value.trim();
    if (!v || busy) return;
    setError(null);
    setText("");
    const pending: CoachMessage = { id: `tmp-${Date.now()}`, role: "user", content: v, createdAt: new Date().toISOString() };
    setMessages((m) => [...m, pending]);
    start(async () => {
      const r = await sendCoachMessage(convId, v);
      if ("error" in r) {
        setError(r.error);
        setMessages((m) => m.filter((x) => x.id !== pending.id));
        setText(v);
        return;
      }
      setMessages((m) => [...m.filter((x) => x.id !== pending.id), ...r.messages]);
      if (r.conversationId !== convId) {
        setConvId(r.conversationId);
        router.replace(`/coach?c=${r.conversationId}`, { scroll: false });
      }
    });
  };

  const toggleMic = () => {
    if (listening) {
      rec.current?.stop();
      return;
    }
    const r = getRecognition();
    if (!r) return;
    r.lang = "it-IT";
    r.interimResults = false;
    r.continuous = false;
    r.onresult = (e) => setText((t) => `${t} ${Array.from(e.results).map((x) => x[0].transcript).join(" ")}`.trim());
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  };

  const apply = (msgId: string, m: CoachMessage, p: Proposal) => {
    if (!m.proposals) return;
    start(async () => {
      const r = await applyProposal(m.proposals!.disruption, p.id);
      setApplied((a) => ({ ...a, [msgId]: "error" in r ? { error: r.error } : { ok: `${p.title}: ${r.ok}`, versionId: r.versionId } }));
      router.refresh();
    });
  };
  const undo = (msgId: string) => {
    const v = applied[msgId]?.versionId;
    if (!v) return;
    start(async () => {
      const r = await undoVersion(v);
      setApplied((a) => ({ ...a, [msgId]: { ...a[msgId], undone: "error" in r ? r.error : r.ok } }));
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {!messages.length && (
        <>
          <Coach>Ciao! Sono il tuo coach. Raccontami cosa succede questa settimana, oppure chiedimi qualcosa sui tuoi allenamenti.</Coach>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" disabled={!enabled || demo || busy} onClick={() => send(s)} className="min-h-11 rounded-full border border-line bg-surface px-4 text-left text-sm text-muted hover:border-faint hover:text-fg disabled:opacity-50">
                {s}
              </button>
            ))}
          </div>
        </>
      )}

      {messages.map((m) =>
        m.role === "user" ? (
          <Me key={m.id}>{m.content}</Me>
        ) : (
          <div key={m.id} className="flex flex-col gap-3">
            <Coach><Text s={m.content} /></Coach>
            {m.proposals?.result.care && <p className="rounded-2xl border border-bad/40 bg-bad/5 px-4 py-3 text-sm">{m.proposals.result.care} <span className="text-muted">Il coach non fa diagnosi.</span></p>}
            {m.proposals && !applied[m.id] && m.proposals.result.proposals.map((p) => <ProposalCard key={p.id} p={p} onApply={() => apply(m.id, m, p)} busy={busy} demo={demo} />)}
            {applied[m.id] && (
              <div className="flex flex-col gap-2">
                <Coach>{applied[m.id].error ? <span className="text-bad">{applied[m.id].error}</span> : applied[m.id].ok}</Coach>
                {applied[m.id].versionId && !applied[m.id].undone && (
                  <button type="button" onClick={() => undo(m.id)} disabled={busy} className="inline-flex min-h-11 items-center gap-2 self-start rounded-xl border border-line px-4 text-sm font-semibold hover:border-faint">
                    <Undo2 className="size-4" aria-hidden /> Annulla questa modifica
                  </button>
                )}
                {applied[m.id].undone && <Coach>{applied[m.id].undone}</Coach>}
              </div>
            )}
          </div>
        ),
      )}
      {busy && <Coach><span className="text-muted">Sto pensando...</span></Coach>}
      {error && <p role="alert" className="rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-bad">{error}</p>}
      <div ref={end} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="sticky bottom-20 flex items-end gap-2 rounded-2xl border border-line bg-surface p-2 shadow-lg shadow-black/40 md:bottom-4"
      >
        {canSpeak && (
          <button type="button" onClick={toggleMic} disabled={!enabled || demo} aria-label={listening ? "Ferma la dettatura" : "Parla al coach"} className={`grid size-11 shrink-0 place-items-center rounded-xl ${listening ? "bg-bad text-white" : "text-muted hover:text-fg"} disabled:opacity-40`}>
            {listening ? <MicOff className="size-5" /> : <Mic className="size-5" />}
          </button>
        )}
        <textarea
          id="coach-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          maxLength={2000}
          disabled={!enabled || demo}
          placeholder={enabled && !demo ? "Scrivi al coach..." : "Coach AI non attivo"}
          className="max-h-40 min-h-11 min-w-0 flex-1 resize-none bg-transparent px-2 py-2.5 text-base placeholder:text-faint focus:outline-none"
        />
        <button type="submit" disabled={!text.trim() || busy || !enabled || demo} aria-label="Invia" className="grid size-11 shrink-0 place-items-center rounded-xl bg-fg text-bg disabled:opacity-40">
          <SendHorizontal className="size-5" />
        </button>
      </form>
    </div>
  );
}
